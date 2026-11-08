import type { Period, StatsData } from "@/lib/queries/stats";
import type { Metric } from "@/components/stats/ranking";
import { formatDateShort } from "@/lib/date";

export type PeriodTop = { name: string; value: number; rank: number }[];
export type PeriodAi = { headline: string; summary: string; highlights: string[]; nextFocus: string; generated_at: string } | null;

export type PeriodReportData = {
  teamName: string;
  period: Period;
  stats: StatsData;
  tops: Record<Metric, PeriodTop>;
  narrative: string[];
  ai: PeriodAi;
  aiConfigured: boolean;
  savedAt: string | null;
};

/** 카톡용 텍스트 */
export function periodReportToText(d: PeriodReportData, link?: string): string {
  const { stats: s, period, tops } = d;
  const L: string[] = [];
  L.push(`📊 ${d.teamName} ${period.label} 결산`);
  if (d.ai?.headline) L.push(`「${d.ai.headline}」`);
  L.push(`모임 ${s.matchCount}회 · ${s.totals.games}쿼터 · 평균 참석 ${s.totals.avgAttendees}명`);
  const ext = s.totals.externalWins + s.totals.externalDraws + s.totals.externalLosses;
  if (ext) L.push(`상대팀 전적 ${s.totals.externalWins}승 ${s.totals.externalDraws}무 ${s.totals.externalLosses}패 (${s.totals.goalsFor}:${s.totals.goalsAgainst})`);
  if (s.opponents.length) {
    L.push("");
    L.push("🆚 상대별");
    for (const o of s.opponents) L.push(`- ${o.opponent}: ${o.wins}승 ${o.draws}무 ${o.losses}패 (${o.gf}:${o.ga})`);
  }
  const line = (title: string, m: Metric, unit: string, fmt?: (v: number) => string) => {
    if (!tops[m].length) return;
    L.push(`${title}: ${tops[m].map((t) => `${["🥇", "🥈", "🥉"][t.rank - 1] ?? ""}${t.name} ${fmt ? fmt(t.value) : t.value}${unit}`).join(", ")}`);
  };
  L.push("");
  line("득점", "goals", "골"); line("도움", "assists", "개"); line("공격P", "points", "P"); line("평점", "rating", "점", (v) => v.toFixed(2));
  line("출석률", "attendance", "%", (v) => v.toFixed(0)); line("골키퍼", "gk", "Q"); line("지각", "late", "회"); line("노쇼", "noshow", "회");
  if (d.ai?.highlights?.length) {
    L.push("");
    L.push("✨ 하이라이트");
    for (const h of d.ai.highlights) L.push(`- ${h}`);
  }
  L.push("");
  L.push(d.ai?.summary ?? d.narrative.join(" "));
  if (d.ai?.nextFocus) L.push(`▶ 다음 기간 목표: ${d.ai.nextFocus}`);
  if (s.matches.length) {
    L.push("");
    L.push("📅 경기 목록");
    for (const m of s.matches) L.push(`- ${formatDateShort(m.match_date)} ${m.opponent ? `vs ${m.opponent} ${m.team_a_goals}:${m.team_b_goals}` : "자체전"} · ${m.attendee_count}명`);
  }
  if (link) { L.push(""); L.push(`자세히: ${link}`); }
  return L.join("\n");
}
