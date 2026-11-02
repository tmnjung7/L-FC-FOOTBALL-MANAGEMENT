import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import type { AttendanceRow, MatchRow, MatchSummaryRow, PlayerRow } from "@/types/database";

/** 모임 목록: 예정(오름차순) + 지난(내림차순) + 예정 모임의 참석 응답 수 */
export async function getMatchList(): Promise<{ upcoming: MatchSummaryRow[]; past: MatchSummaryRow[]; rsvp: Map<string, number> }> {
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("v_match_summary").select("*").order("match_date", { ascending: false });
  const all = data ?? [];
  const upcoming = all.filter((m) => m.status === "scheduled" && m.match_date >= today).sort((a, b) => a.match_date.localeCompare(b.match_date));
  const past = all.filter((m) => !(m.status === "scheduled" && m.match_date >= today));

  const rsvp = new Map(upcoming.map((m) => [m.match_id, m.rsvp_yes_count]));
  return { upcoming, past, rsvp };
}

/** 최근 사용한 장소 (입력 자동완성용) */
export async function getRecentVenues(limit = 5): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select("venue").not("venue", "is", null).order("match_date", { ascending: false }).limit(40);
  const seen: string[] = [];
  for (const r of data ?? []) {
    if (r.venue && !seen.includes(r.venue)) seen.push(r.venue);
    if (seen.length >= limit) break;
  }
  return seen;
}

export type MatchDetail = {
  match: MatchRow;
  players: PlayerRow[]; // 활성 선수 + 출석 행이 있는 비활성 선수
  attendance: AttendanceRow[];
};

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) return null;
  const [{ data: players }, { data: attendance }] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    supabase.from("attendance").select("*").eq("match_id", id),
  ]);
  const att = attendance ?? [];
  const attIds = new Set(att.map((a) => a.player_id));
  const visible = (players ?? []).filter((p) => p.is_active || attIds.has(p.id));
  return { match, players: visible, attendance: att };
}
