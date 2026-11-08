/**
 * 경기 보고서 요약 문장 생성 (템플릿 방식).
 * 나중에 Claude API 로 바꿀 때 이 파일만 교체하면 된다.
 */
import type { ReportData } from "@/lib/report/build";

/** 받침 유무에 따라 조사 선택: josa("철수","이","가") → "철수가" */
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + without; // 한글 아님
  return word + ((last - 0xac00) % 28 === 0 ? without : withBatchim);
}

export function buildNarrative(d: ReportData): string[] {
  const out: string[] = [];
  const dateText = d.dateLabel;
  const place = d.venue ? `${d.venue}에서 ` : "";
  out.push(`${dateText} ${place}${d.attendeeCount}명이 모여 ${d.quarters.length}쿼터를 소화했습니다${d.lateCount ? ` (지각 ${d.lateCount}명)` : ""}.`);

  if (d.quarters.length > 0) {
    if (d.opponent) {
      const r = d.totalA > d.totalB ? "이겼습니다" : d.totalA === d.totalB ? "비겼습니다" : "졌습니다";
      const best = [...d.quarters].sort((a, b) => (b.a - b.b) - (a.a - a.b))[0];
      out.push(`${josa(d.opponent, "과", "와")}의 경기는 합계 ${d.totalA}:${d.totalB}로 ${r}.${best && best.a > best.b ? ` 가장 좋았던 쿼터는 Q${best.n}(${best.a}:${best.b})였습니다.` : ""}`);
    } else {
      out.push(`자체전은 A팀 기준 ${d.winsA}승 ${d.draws}무 ${d.lossesA}패, 총 ${d.totalA + d.totalB}골이 터졌습니다.`);
    }
  }

  if (d.topScorers.length > 0) {
    const s = d.topScorers[0];
    const a = d.topAssists[0];
    out.push(`${josa(s.name, "이", "가")} ${s.value}골로 득점 1위${a ? `, 도움은 ${josa(a.name, "이", "가")} ${a.value}개로 가장 많았습니다` : "였습니다"}.`);
  }

  if (d.mvp) {
    const rated = d.topRated[0];
    const who = d.mvp.byAdmin ? `오늘의 MVP는 ${d.mvp.name}` : `MVP는 ${d.mvp.votes}표를 받은 ${d.mvp.name}`;
    const keyword = d.playerLines.find((p) => p.isMvp)?.note;
    out.push(`${who}${keyword ? ` (${keyword})` : ""}${rated && rated.name !== d.mvp.name ? `, 평점 1위는 ${rated.name}(${rated.value.toFixed(1)}점)입니다` : "입니다"}.`);
  } else if (d.topRated.length > 0) {
    const rated = d.topRated[0];
    out.push(`평점 1위는 ${rated.name}(${rated.value.toFixed(1)}점, ${rated.count}명 평가)입니다.`);
  }

  if (d.playTime.length > 1) {
    const most = d.playTime[0];
    const least = d.playTime[d.playTime.length - 1];
    const diff = most.quarters - least.quarters;
    out.push(diff <= 1
      ? (diff === 0 ? `출전은 모두 ${most.quarters}쿼터씩 고르게 돌렸습니다.` : `출전은 ${least.quarters}~${most.quarters}쿼터로 고르게 돌렸습니다.`)
      : `출전은 최다 ${most.name} ${most.quarters}쿼터, 최소 ${least.name} ${least.quarters}쿼터로 ${diff}쿼터 차이가 났습니다. 다음 편성 때 참고하세요.`);
  }

  // 대표 총평이 있으면 맨 뒤에 붙인다 (요약 5문장 + 총평)
  const body = out.slice(0, 5);
  if (d.memo) body.push(`총평: ${d.memo}`);
  return body;
}
