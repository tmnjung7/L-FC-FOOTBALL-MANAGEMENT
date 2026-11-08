import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/date";
import { buildNarrative } from "@/lib/report/narrative";
import type { MatchRow } from "@/types/database";

export type Ranked = { player_id: string; name: string; value: number; count?: number };
export type ReportData = {
  matchId: string;
  teamName: string;
  dateLabel: string; // 2026-11-08 (일)
  timeLabel: string;
  venue: string | null;
  format: string;
  opponent: string | null;
  status: MatchRow["status"];
  attendeeCount: number;
  lateCount: number;
  attendees: { name: string; status: "present" | "late"; late_minutes: number | null }[];
  quarters: { n: number; a: number; b: number }[];
  totalA: number;
  totalB: number;
  winsA: number;
  draws: number;
  lossesA: number;
  topScorers: Ranked[];
  topAssists: Ranked[];
  topRated: Ranked[]; // value = 평균, count = 평가 수
  ratingCount: number; // 평가 건수
  raterCount: number; // 평가 참여 인원
  mvp: { name: string; votes: number; byAdmin: boolean } | null;
  mvpVotes: { name: string; votes: number }[];
  /** 대표 총평 */
  memo: string | null;
  /** 참석자별 코멘트: 기록 수치 + 대표 키워드 (보고서 본문) */
  playerLines: { name: string; stats: string; note: string | null; isMvp: boolean }[];
  playTime: { name: string; quarters: number }[]; // 많이 뛴 순
  notes: { name: string; note: string }[]; // 선수별 비고(키워드)
  comments: { name: string; comment: string }[];
  feedbackCount: number;
  narrative: string[];
  generatedAt: string;
  /** AI 가 다듬어 쓴 보고서 (있으면 화면·텍스트·이미지에서 우선 사용) */
  ai: { headline: string; summary: string; playerComments: { name: string; comment: string }[]; nextFocus: string; generated_at: string } | null;
  aiConfigured: boolean;
};

/** 모임 하나의 보고서 데이터를 DB 에서 모아 만든다 (항상 최신 기준) */
export async function buildReport(matchId: string): Promise<ReportData | null> {
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return null;

  const [{ data: settings }, { data: players }, { data: attendance }, { data: games }, { data: ratings }, { data: feedback }, { data: saved }] = await Promise.all([
    supabase.from("team_settings").select("team_name").eq("id", 1).maybeSingle(),
    supabase.from("players").select("id, name"),
    supabase.from("attendance").select("player_id, status, late_minutes, note").eq("match_id", matchId),
    supabase.from("games").select("id, game_number, team_a_score, team_b_score").eq("match_id", matchId).order("game_number"),
    supabase.from("ratings").select("player_id, rater_id, score").eq("match_id", matchId),
    supabase.from("match_feedback").select("player_id, comment, mvp_vote_id").eq("match_id", matchId),
    supabase.from("match_reports").select("summary_json").eq("match_id", matchId).maybeSingle(),
  ]);
  const savedJson = saved?.summary_json as { admin_input?: { mvp_player_id: string | null; memo: string | null }; ai?: ReportData["ai"] } | null;
  const adminInput = savedJson?.admin_input ?? null;
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.name]));
  const name = (id: string | null) => (id ? (nameOf.get(id) ?? "?") : "?");

  const gameIds = (games ?? []).map((g) => g.id);
  const [{ data: gp }, { data: events }] = gameIds.length
    ? await Promise.all([
        supabase.from("game_players").select("player_id, game_id, position").in("game_id", gameIds),
        supabase.from("events").select("scorer_id, assist_id, is_own_goal, team").in("game_id", gameIds),
      ])
    : [{ data: [] as { player_id: string; game_id: string; position: string | null }[] }, { data: [] as { scorer_id: string | null; assist_id: string | null; is_own_goal: boolean; team: "A" | "B" }[] }];

  const present = (attendance ?? []).filter((a) => a.status === "present" || a.status === "late");
  const quarters = (games ?? []).map((g) => ({ n: g.game_number, a: g.team_a_score, b: g.team_b_score }));
  const totalA = quarters.reduce((n, q) => n + q.a, 0);
  const totalB = quarters.reduce((n, q) => n + q.b, 0);

  const count = (ids: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const id of ids) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].map(([player_id, value]) => ({ player_id, name: name(player_id), value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  };
  const topScorers = count((events ?? []).filter((e) => !e.is_own_goal).map((e) => e.scorer_id)).slice(0, 3);
  const topAssists = count((events ?? []).map((e) => e.assist_id)).slice(0, 3);

  const ratingAgg = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    const cur = ratingAgg.get(r.player_id) ?? { sum: 0, n: 0 };
    ratingAgg.set(r.player_id, { sum: cur.sum + Number(r.score), n: cur.n + 1 });
  }
  const topRated = [...ratingAgg.entries()]
    .map(([player_id, v]) => ({ player_id, name: name(player_id), value: Math.round((v.sum / v.n) * 100) / 100, count: v.n }))
    .sort((a, b) => b.value - a.value || (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 3);
  const ratingById = new Map(topRated.map((r) => [r.player_id, r.value]));

  const voteCount = count((feedback ?? []).map((f) => f.mvp_vote_id));
  const mvpVotes = voteCount.map((v) => ({ name: v.name, votes: v.value }));
  let mvp: ReportData["mvp"] = null;
  if (adminInput?.mvp_player_id) {
    // 대표 지정이 최우선
    const votes = voteCount.find((v) => v.player_id === adminInput.mvp_player_id)?.value ?? 0;
    mvp = { name: name(adminInput.mvp_player_id), votes, byAdmin: true };
  } else if (voteCount.length > 0) {
    const top = voteCount.filter((v) => v.value === voteCount[0].value);
    const pick = top.sort((a, b) => (ratingById.get(b.player_id) ?? 0) - (ratingById.get(a.player_id) ?? 0))[0];
    mvp = { name: pick.name, votes: pick.value, byAdmin: false };
  }

  const playTime = count((gp ?? []).map((x) => x.player_id)).map((x) => ({ name: x.name, quarters: x.value }));

  // 참석자별 코멘트 라인 (출전 많은 순)
  const goalsBy = new Map(count((events ?? []).filter((e) => !e.is_own_goal).map((e) => e.scorer_id)).map((x) => [x.player_id, x.value]));
  const assistsBy = new Map(count((events ?? []).map((e) => e.assist_id)).map((x) => [x.player_id, x.value]));
  const quartersBy = new Map(count((gp ?? []).map((x) => x.player_id)).map((x) => [x.player_id, x.value]));
  const gkBy = new Map(count((gp ?? []).filter((x) => x.position === "GK").map((x) => x.player_id)).map((x) => [x.player_id, x.value]));
  const noteBy = new Map((attendance ?? []).filter((a) => a.note).map((a) => [a.player_id, a.note!]));
  const playerLines = present
    .map((a) => {
      const g = goalsBy.get(a.player_id) ?? 0, as = assistsBy.get(a.player_id) ?? 0, q = quartersBy.get(a.player_id) ?? 0, k = gkBy.get(a.player_id) ?? 0;
      const parts = [`${q}쿼터`];
      if (g) parts.push(`${g}골`);
      if (as) parts.push(`${as}도움`);
      if (k) parts.push(`GK ${k}Q`);
      if (a.status === "late") parts.push(`지각${a.late_minutes ? ` ${a.late_minutes}분` : ""}`);
      const mvpId = adminInput?.mvp_player_id ?? null;
      return { player_id: a.player_id, name: name(a.player_id), stats: parts.join(" · "), note: noteBy.get(a.player_id) ?? null, isMvp: mvpId ? mvpId === a.player_id : mvp?.name === name(a.player_id), q };
    })
    .sort((a, b) => b.q - a.q || a.name.localeCompare(b.name))
    .map(({ name, stats, note, isMvp }) => ({ name, stats, note, isMvp }));

  const data: ReportData = {
    matchId,
    teamName: settings?.team_name ?? "L-FC",
    dateLabel: formatDate(match.match_date),
    timeLabel: formatTime(match.start_time),
    venue: match.venue,
    format: match.format,
    opponent: match.opponent,
    status: match.status,
    attendeeCount: present.length,
    lateCount: present.filter((a) => a.status === "late").length,
    attendees: present.map((a) => ({ name: name(a.player_id), status: a.status as "present" | "late", late_minutes: a.late_minutes })).sort((a, b) => a.name.localeCompare(b.name)),
    quarters,
    totalA,
    totalB,
    winsA: quarters.filter((q) => q.a > q.b).length,
    draws: quarters.filter((q) => q.a === q.b).length,
    lossesA: quarters.filter((q) => q.a < q.b).length,
    topScorers,
    topAssists,
    topRated,
    ratingCount: (ratings ?? []).length,
    raterCount: new Set((ratings ?? []).map((r) => r.rater_id)).size,
    mvp,
    mvpVotes,
    memo: adminInput?.memo ?? null,
    playerLines,
    playTime,
    notes: (attendance ?? []).filter((a) => a.note).map((a) => ({ name: name(a.player_id), note: a.note! })).sort((a, b) => a.name.localeCompare(b.name)),
    comments: (feedback ?? []).filter((f) => f.comment).map((f) => ({ name: name(f.player_id), comment: f.comment! })),
    feedbackCount: (feedback ?? []).length,
    narrative: [],
    generatedAt: new Date().toISOString(),
    ai: savedJson?.ai ?? null,
    aiConfigured: !!process.env.ANTHROPIC_API_KEY,
  };
  data.narrative = buildNarrative(data);
  return data;
}
