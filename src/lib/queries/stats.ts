import { createClient } from "@/lib/supabase/server";
import { todayISO, toISODate, parseISODate } from "@/lib/date";
import type { PlayerSeasonStatsRow } from "@/types/database";

export type PeriodKey = "month" | "lastmonth" | "quarter" | "lastquarter" | "year" | "lastyear" | "3m" | "all" | "custom";
export type Period = {
  key: PeriodKey;
  from: string | null;
  to: string | null;
  label: string;
  /** period_reports.period_type 매핑 */
  type: "month" | "quarter" | "year" | "custom";
};

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** URL 파라미터 → 기간 */
export function resolvePeriod(key: string | undefined, from?: string, to?: string): Period {
  const today = todayISO();
  const d = parseISODate(today);
  const y = d.getFullYear(), m0 = d.getMonth();
  const monthRange = (yy: number, mm0: number): Period => ({
    key: "month", type: "month",
    from: `${yy}-${pad(mm0 + 1)}-01`, to: `${yy}-${pad(mm0 + 1)}-${pad(lastDay(yy, mm0))}`,
    label: `${yy}년 ${mm0 + 1}월`,
  });
  const quarterRange = (yy: number, q: number): Period => ({
    key: "quarter", type: "quarter",
    from: `${yy}-${pad(q * 3 + 1)}-01`, to: `${yy}-${pad(q * 3 + 3)}-${pad(lastDay(yy, q * 3 + 2))}`,
    label: `${yy}년 ${q + 1}분기`,
  });
  if (key === "month") return monthRange(y, m0);
  if (key === "lastmonth") { const r = monthRange(m0 === 0 ? y - 1 : y, m0 === 0 ? 11 : m0 - 1); return { ...r, key: "lastmonth" }; }
  if (key === "quarter") return quarterRange(y, Math.floor(m0 / 3));
  if (key === "lastquarter") { const q = Math.floor(m0 / 3); const r = q === 0 ? quarterRange(y - 1, 3) : quarterRange(y, q - 1); return { ...r, key: "lastquarter" }; }
  if (key === "lastyear") return { key: "lastyear", type: "year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `${y - 1}년` };
  if (key === "3m") {
    const f = new Date(y, m0 - 3, d.getDate());
    return { key: "3m", type: "custom", from: toISODate(f), to: today, label: "최근 3개월" };
  }
  if (key === "all") return { key: "all", type: "custom", from: null, to: null, label: "전체" };
  if (key === "custom" && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
    return { key: "custom", type: "custom", from, to: t, label: `${from} ~ ${t}` };
  }
  return { key: "year", type: "year", from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}년` };
}

export type MonthBucket = { month: string; label: string; matches: number; avgAttendees: number };
export type ScorerTrendPoint = { month: string; label: string; [player: string]: number | string };
export type PlayTimeRow = { name: string; played: number; rest: number };

export type OpponentRecord = { opponent: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number };
export type StatsData = {
  players: PlayerSeasonStatsRow[]; // 활성 + 기간 내 기록 있는 선수
  months: MonthBucket[];
  scorerTrend: { points: ScorerTrendPoint[]; names: string[] };
  playTime: PlayTimeRow[];
  matchCount: number;
  /** 기간 합계 */
  totals: { games: number; goalsFor: number; goalsAgainst: number; avgAttendees: number; lateTotal: number; externalWins: number; externalDraws: number; externalLosses: number; internalMatches: number };
  opponents: OpponentRecord[];
  matches: { match_id: string; match_date: string; opponent: string | null; team_a_goals: number; team_b_goals: number; attendee_count: number; venue: string | null }[];
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
      let q = supabase.from("v_match_summary").select("match_id, match_date, attendee_count, status, opponent, team_a_goals, team_b_goals, game_count, late_count, venue").eq("status", "done");
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

  // 상대팀별 전적 + 기간 합계
  const oppMap = new Map<string, OpponentRecord>();
  let ew = 0, ed = 0, el = 0, internal = 0;
  for (const m of matches) {
    if (!m.opponent) { internal++; continue; }
    const r = oppMap.get(m.opponent) ?? { opponent: m.opponent, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    r.played++; r.gf += m.team_a_goals; r.ga += m.team_b_goals;
    if (m.team_a_goals > m.team_b_goals) { r.wins++; ew++; } else if (m.team_a_goals === m.team_b_goals) { r.draws++; ed++; } else { r.losses++; el++; }
    oppMap.set(m.opponent, r);
  }
  const totals = {
    games: matches.reduce((n, m) => n + m.game_count, 0),
    goalsFor: matches.reduce((n, m) => n + m.team_a_goals, 0),
    goalsAgainst: matches.reduce((n, m) => n + m.team_b_goals, 0),
    avgAttendees: matches.length ? Math.round((matches.reduce((n, m) => n + m.attendee_count, 0) / matches.length) * 10) / 10 : 0,
    lateTotal: matches.reduce((n, m) => n + m.late_count, 0),
    externalWins: ew, externalDraws: ed, externalLosses: el, internalMatches: internal,
  };

  return {
    players: rows, months, scorerTrend: { points, names: top5.map((t) => t.name) }, playTime, matchCount: matches.length,
    totals,
    opponents: [...oppMap.values()].sort((a, b) => b.played - a.played),
    matches: matches.map((m) => ({ match_id: m.match_id, match_date: m.match_date, opponent: m.opponent, team_a_goals: m.team_a_goals, team_b_goals: m.team_b_goals, attendee_count: m.attendee_count, venue: m.venue })),
  };
}
