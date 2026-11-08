import type { ReportData } from "@/lib/report/build";

/** 카톡에 붙여넣는 텍스트 보고서 */
export function reportToText(d: ReportData, link?: string): string {
  const L: string[] = [];
  L.push(`⚽ ${d.teamName} 경기 결과 · ${d.dateLabel}`);
  if (d.ai?.headline) L.push(`「${d.ai.headline}」`);
  L.push(`${d.opponent ? `vs ${d.opponent} · ` : "자체전 · "}${d.venue ?? "장소 미정"}${d.timeLabel ? ` ${d.timeLabel}` : ""} · ${d.attendeeCount}명${d.lateCount ? ` (지각 ${d.lateCount})` : ""}`);
  if (d.quarters.length) {
    const r = d.opponent ? (d.totalA > d.totalB ? "승" : d.totalA === d.totalB ? "무" : "패") : `A ${d.winsA}승 ${d.draws}무 ${d.lossesA}패`;
    L.push(`합계 ${d.totalA}:${d.totalB} ${r}`);
    L.push(d.quarters.map((q) => `Q${q.n} ${q.a}:${q.b}`).join(" · "));
  }
  L.push("");
  if (d.topScorers.length) L.push(`🥇 득점: ${d.topScorers.map((s) => `${s.name} ${s.value}`).join(", ")}`);
  if (d.topAssists.length) L.push(`🎯 도움: ${d.topAssists.map((s) => `${s.name} ${s.value}`).join(", ")}`);
  if (d.topRated.length) L.push(`⭐ 평점: ${d.topRated.map((s) => `${s.name} ${s.value.toFixed(1)}`).join(", ")} (${d.raterCount}명 평가)`);
  else L.push("⭐ 평점 미입력");
  if (d.mvp) L.push(`🏆 MVP: ${d.mvp.name}${d.mvp.byAdmin ? "" : ` (${d.mvp.votes}표)`}`);
  if (d.playTime.length) L.push(`🔁 출전: 최다 ${d.playTime[0].name} ${d.playTime[0].quarters}Q · 최소 ${d.playTime[d.playTime.length - 1].name} ${d.playTime[d.playTime.length - 1].quarters}Q`);
  if (d.ai?.playerComments?.length) {
    L.push("");
    L.push("📝 선수별 코멘트");
    const statsBy = new Map(d.playerLines.map((p) => [p.name, p]));
    for (const c of d.ai.playerComments) {
      const p = statsBy.get(c.name);
      L.push(`- ${p?.isMvp ? "🏆 " : ""}${c.name}${p ? ` (${p.stats})` : ""}: ${c.comment}`);
    }
  } else if (d.playerLines.length) {
    L.push("");
    L.push("📝 선수별 코멘트");
    for (const p of d.playerLines) L.push(`- ${p.isMvp ? "🏆 " : ""}${p.name} (${p.stats})${p.note ? `: ${p.note}` : ""}`);
  }
  if (d.comments.length) {
    L.push("");
    L.push("💬 팀원 피드백");
    for (const c of d.comments) L.push(`- ${c.name}: ${c.comment}`);
  }
  if (d.ai?.summary) {
    L.push("");
    L.push(d.ai.summary);
    if (d.ai.nextFocus) L.push(`▶ 다음 경기: ${d.ai.nextFocus}`);
  } else if (d.narrative.length) {
    L.push("");
    L.push(d.narrative.join(" "));
  }
  if (link) {
    L.push("");
    L.push(`자세히: ${link}`);
  }
  return L.join("\n");
}
