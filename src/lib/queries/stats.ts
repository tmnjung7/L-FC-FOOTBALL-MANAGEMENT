import { createClient } from "@/lib/supabase/server";
import { todayISO, toISODate, parseISODate } from "@/lib/date";
import type { PlayerSeasonStatsRow } from "@/types/database";

export type PeriodKey = "year" | "3m" | "all" | "custom";
export type Period = { key: PeriodKey; from: string | null; to: string | null; label: string };

/** URL 파라미터 → 기간 */
export function resolvePeriod(key: string | undefined, from?: string, to?: string): Period {
  const today = todayISO();
  const d = parseISODate(today);
  if (key === "3m") {
    const f = new Date(d.getFullYear(), d.getMonth() - 3, d.getDate());
    return { key: "3m", from: toISODate(f), to: today, label: "최근 3개월" };
  }
  if (key === "all") return { key: "all", from: null, to: null, label: "전체" };
  if (key === "custom" && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
    return { key: "custom", from, to: t, label: `${from} ~ ${t}` };
  }
  return { key: "year", from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()}년` };
}

export type MonthBucket = { month: string; label: string; matches: number; avgAttendees: number };
export type ScorerTrendPoint = { month: string; label: string; [player: string]: number | string };
export type PlayTimeRow = { name: string; played: number; rest: number };

export type StatsData = {
  players: PlayerSeasonStatsRow[]; // 활성 + 기간 내 기록 있는 선수
  months: MonthBucket[];
  scorerTrend: { points: ScorerTrendPoint[]; names: string[] };
  playTime: PlayTimeRow[];
  matchCount: number;
};

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}.${Number(m)}`;
}

/** 통계 탭 데이터 한 번에 */
export async function getStats(period: Period): Promise<StatsData> {
  const supabase = await createClient();
  const [{ data: stats }, matchesQ] = await Promise.all([
    supabase.rpc("fn_player_season_stats", { p_from: period.from, p_to: period.to }),
    (() => {
      let q = supabase.from("v_match_summary").select("match_id, match_date, attendee_count, status").eq("status", "done");
      if (period.from) q = q.gte("match_date", period.from);
      if (period.to) q = q.lte("match_date", period.to);
      return q.order("match_date");
    })(),
  ]);
  const rows: PlayerSeasonStatsRow[] = (stats ?? []).filter((r) => r.is_active || r.matches_played > 0);
  const matches = matchesQ.data ?? [];

  // 월별 모임 수 · 평균 참석
  const byMonth = new Map<string, { n: number; att: number }>();
  for (const m of matches) {
    const ym = m.match_date.slice(0, 7);
    const cur = byMonth.get(ym) ?? { n: 0, att: 0 };
    byMonth.set(ym, { n: cur.n + 1, att: cur.att + m.attendee_count });
  }
  const months: MonthBucket[] = [...byMonth.entries()].sort().map(([month, v]) => ({ month, label: monthLabel(month), matches: v.n, avgAttendees: v.n ? Math.round((v.att / v.n) * 10) / 10 : 0 }));

  // 상위 5명 득점 월별 추이
  const top5 = [...rows].sort((a, b) => b.goals - a.goals).slice(0, 5).filter((r) => r.goals > 0);
  let points: ScorerTrendPoint[] = [];
  if (top5.length > 0 && matches.length > 0) {
    const ids = matches.map((m) => m.match_id);
    const { data: games } = await supabase.from("games").select("id, match_id").in("match_id", ids);
    const gameIds = (games ?? []).map((g) => g.id);
    const gameMonth = new Map((games ?? []).map((g) => [g.id, matches.find((m) => m.match_id === g.match_id)!.match_date.slice(0, 7)]));
    const { data: events } = gameIds.length
      ? await supabase.from("events").select("game_id, scorer_id, is_own_goal").in("game_id", gameIds).in("scorer_id", top5.map((t) => t.player_id)).eq("is_own_goal", false)
      : { data: [] as { game_id: string; scorer_id: string | null; is_own_goal: boolean }[] };
    const nameOf = new Map(top5.map((t) => [t.player_id, t.name]));
    const acc = new Map<string, Record<string, number>>();
    for (const ym of byMonth.keys()) acc.set(ym, Object.fromEntries(top5.map((t) => [t.name, 0])));
    for (const e of events ?? []) {
      const ym = gameMonth.get(e.game_id);
      const name = e.scorer_id ? nameOf.get(e.scorer_id) : undefined;
      if (!ym || !name) continue;
      const rec = acc.get(ym);
      if (rec) rec[name] = (rec[name] ?? 0) + 1;
    }
    points = [...acc.entries()].sort().map(([month, rec]) => ({ month, label: monthLabel(month), ...rec }));
  }

  const playTime: PlayTimeRow[] = rows
    .filter((r) => r.matches_played > 0)
    .map((r) => ({ name: r.name, played: r.quarters_played, rest: r.rest_quarters }))
    .sort((a, b) => b.played - a.played);

  return { players: rows, months, scorerTrend: { points, names: top5.map((t) => t.name) }, playTime, matchCount: matches.length };
}
