import { createClient } from "@/lib/supabase/server";
import { monthRange, todayISO, daysBetween } from "@/lib/date";
import type { MatchRow, MatchSummaryRow, PlayerSeasonStatsRow, RsvpAnswer, TeamSettingsRow } from "@/types/database";

// ---------------------------------------------------------------------------
// 홈 화면 데이터 조회 (서버 전용)
// ---------------------------------------------------------------------------

export async function getTeamSettings(): Promise<TeamSettingsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("team_settings").select("*").eq("id", 1).maybeSingle();
  return data ?? null;
}

export type NextMatch = {
  match: MatchRow;
  going: number; // 투표 참석
  notGoing: number; // 투표 불참
  mine: RsvpAnswer | null; // 내 투표
};

/** 오늘 이후 가장 가까운 예정 모임 + 참석 응답 현황 */
export async function getNextMatch(playerId: string | null): Promise<NextMatch | null> {
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "scheduled")
    .gte("match_date", todayISO())
    .order("match_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!match) return null;

  const { data: att } = await supabase
    .from("attendance")
    .select("player_id, rsvp")
    .eq("match_id", match.id);
  const rows = att ?? [];

  return {
    match,
    going: rows.filter((a) => a.rsvp === "yes").length,
    notGoing: rows.filter((a) => a.rsvp === "no").length,
    mine: playerId ? (rows.find((a) => a.player_id === playerId)?.rsvp ?? null) : null,
  };
}

/** 최근 끝난 모임 3개 요약 */
export async function getRecentResults(limit = 3): Promise<MatchSummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_match_summary")
    .select("*")
    .eq("status", "done")
    .order("match_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export type Leader = { name: string; value: number; sub?: string };
export type MonthLeaders = {
  label: string; // '2026년 11월'
  goals: Leader | null;
  assists: Leader | null;
  rating: Leader | null;
  hasData: boolean;
};

/** 이번 달 득점왕 · 어시왕 · 평점왕 */
export async function getMonthLeaders(): Promise<MonthLeaders> {
  const supabase = await createClient();
  const { from, to, label } = monthRange(todayISO());
  const { data } = await supabase.rpc("fn_player_season_stats", { p_from: from, p_to: to });
  const rows: PlayerSeasonStatsRow[] = data ?? [];
  const played = rows.filter((r) => r.matches_played > 0);

  const top = (key: "goals" | "assists") => {
    const best = [...played].sort((a, b) => b[key] - a[key])[0];
    return best && best[key] > 0 ? { name: best.name, value: best[key] } : null;
  };
  const rated = played.filter((r) => r.avg_rating != null && r.rating_count >= 3);
  const bestRated = [...rated].sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating))[0];

  return {
    label,
    goals: top("goals"),
    assists: top("assists"),
    rating: bestRated
      ? { name: bestRated.name, value: Number(bestRated.avg_rating), sub: `${bestRated.rating_count}명 평가` }
      : null,
    hasData: played.length > 0,
  };
}

export type PendingRating = { match: MatchRow; hoursLeft: number };

/**
 * 내가 참석했는데 아직 평점을 안 남긴, 마감 전인 모임 목록
 * (team_settings.rating_enabled 가 꺼져 있으면 빈 배열)
 */
export async function getPendingRatings(
  playerId: string | null,
  settings: TeamSettingsRow | null,
): Promise<PendingRating[]> {
  if (!playerId || !settings?.rating_enabled) return [];
  const supabase = await createClient();
  const deadlineDays = Math.ceil(settings.rating_deadline_hours / 24) + 1;
  const today = todayISO();
  const since = new Date(Date.now() - deadlineDays * 86_400_000).toISOString().slice(0, 10);

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "done")
    .gte("match_date", since)
    .order("match_date", { ascending: false });
  if (!matches?.length) return [];

  const ids = matches.map((m) => m.id);
  const [{ data: att }, { data: mine }] = await Promise.all([
    supabase.from("attendance").select("match_id, status").eq("player_id", playerId).in("match_id", ids),
    supabase.from("ratings").select("match_id").eq("rater_id", playerId).in("match_id", ids),
  ]);
  const attended = new Set((att ?? []).filter((a) => a.status === "present" || a.status === "late").map((a) => a.match_id));
  const rated = new Set((mine ?? []).map((r) => r.match_id));

  return matches
    .filter((m) => attended.has(m.id) && !rated.has(m.id))
    .map((m) => {
      // 모임 당일 자정 기준으로 남은 시간 계산 (대략)
      const elapsedHours = daysBetween(m.match_date, today) * 24;
      return { match: m, hoursLeft: settings.rating_deadline_hours - elapsedHours };
    })
    .filter((p) => p.hoursLeft > 0);
}
