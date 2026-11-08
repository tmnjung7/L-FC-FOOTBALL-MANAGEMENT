import { createClient } from "@/lib/supabase/server";
import { getStats, type Period } from "@/lib/queries/stats";
import { rankPlayers, type Metric } from "@/components/stats/ranking";
import { josa } from "@/lib/report/narrative";
import type { PeriodAi, PeriodReportData, PeriodTop } from "@/lib/report/period-text";

export type { PeriodAi, PeriodReportData, PeriodTop } from "@/lib/report/period-text";
export { periodReportToText } from "@/lib/report/period-text";

const TOP_METRICS: Metric[] = ["goals", "assists", "points", "rating", "attendance", "gk", "late", "noshow"];

/** 결산 리포트 데이터 (기간 기준). 저장본(period_reports)이 있으면 AI 글을 함께 돌려준다 */
export async function buildPeriodReport(period: Period): Promise<PeriodReportData> {
  const supabase = await createClient();
  const [stats, { data: settings }, { data: saved }] = await Promise.all([
    getStats(period),
    supabase.from("team_settings").select("team_name").eq("id", 1).maybeSingle(),
    period.from && period.to
      ? supabase.from("period_reports").select("summary_json, generated_at").eq("period_type", period.type).eq("period_start", period.from).eq("period_end", period.to).maybeSingle()
      : Promise.resolve({ data: null as { summary_json: unknown; generated_at: string } | null }),
  ]);
  const tops = Object.fromEntries(TOP_METRICS.map((m) => [m, rankPlayers(stats.players, m).slice(0, 3).map((r) => ({ name: r.r.name, value: r.v, rank: r.rank }))])) as Record<Metric, PeriodTop>;
  const savedJson = (saved?.summary_json as { ai?: PeriodAi } | null) ?? null;
  const data: PeriodReportData = {
    teamName: settings?.team_name ?? "L-FC",
    period,
    stats,
    tops,
    narrative: [],
    ai: savedJson?.ai ?? null,
    aiConfigured: !!process.env.ANTHROPIC_API_KEY,
    savedAt: saved?.generated_at ?? null,
  };
  data.narrative = buildPeriodNarrative(data);
  return data;
}

/** 템플릿 요약 (AI 없을 때) */
export function buildPeriodNarrative(d: PeriodReportData): string[] {
  const { stats: s, period } = d;
  const out: string[] = [];
  if (s.matchCount === 0) return [`${period.label}에는 완료된 모임이 없습니다.`];
  out.push(`${period.label} 동안 ${s.matchCount}회 모여 ${s.totals.games}쿼터를 뛰었고, 평균 ${s.totals.avgAttendees}명이 참석했습니다.`);
  const ext = s.totals.externalWins + s.totals.externalDraws + s.totals.externalLosses;
  if (ext > 0) out.push(`상대팀 경기 ${ext}회 전적은 ${s.totals.externalWins}승 ${s.totals.externalDraws}무 ${s.totals.externalLosses}패 (${s.totals.goalsFor}득점 ${s.totals.goalsAgainst}실점)${s.totals.internalMatches ? `, 자체전은 ${s.totals.internalMatches}회` : ""}였습니다.`);
  const g = d.tops.goals[0], a = d.tops.assists[0];
  if (g) out.push(`득점왕은 ${g.value}골의 ${g.name}${a ? `, 도움왕은 ${a.value}개의 ${a.name}` : ""}입니다.`);
  const r = d.tops.rating[0], att = d.tops.attendance[0];
  if (r || att) out.push(`${r ? `평점 1위는 ${r.name}(${r.value.toFixed(2)}점)` : ""}${r && att ? ", " : ""}${att ? `출석률 1위는 ${att.name}(${att.value.toFixed(0)}%)` : ""}입니다.`);
  const gk = d.tops.gk[0];
  if (gk) out.push(`골키퍼는 ${josa(gk.name, "이", "가")} ${gk.value}쿼터로 가장 많이 맡았습니다.`);
  if (s.totals.lateTotal > 0 || d.tops.noshow.length > 0) {
    out.push(`지각은 총 ${s.totals.lateTotal}회${d.tops.late[0] ? ` (최다 ${d.tops.late[0].name} ${d.tops.late[0].value}회)` : ""}${d.tops.noshow[0] ? `, 노쇼는 ${d.tops.noshow[0].name} ${d.tops.noshow[0].value}회` : ""}였습니다.`);
  }
  if (s.playTime.length > 1) {
    const most = s.playTime[0], least = s.playTime[s.playTime.length - 1];
    out.push(`출전 쿼터는 최다 ${most.name} ${most.played}, 최소 ${least.name} ${least.played}입니다.`);
  }
  return out.slice(0, 6);
}

