import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReportData } from "@/lib/report/build";
import { reportToText } from "@/lib/report/text";

/** AI 가 다듬어 쓴 보고서 (match_reports.summary_json.ai 에 저장) */
export const AiReportSchema = z.object({
  headline: z.string().describe("한 줄 제목. 20자 이내. 예: '후반 뒷심으로 7:5 역전승'"),
  summary: z.string().describe("경기 총평 3~5문장. 대표의 총평과 키워드를 자연스럽게 녹여 쓴 한국어 산문. 숫자는 주어진 기록만 사용"),
  playerComments: z.array(z.object({
    name: z.string(),
    comment: z.string().describe("그 선수에 대한 1~2문장 코멘트. 대표가 적은 키워드를 바탕으로, 기록 수치를 곁들여, 격려하는 톤으로"),
  })).describe("참석자 전원. 대표 키워드가 없는 선수는 기록만으로 짧게"),
  nextFocus: z.string().describe("다음 경기 준비 포인트 1~2문장"),
});
export type AiReport = z.infer<typeof AiReportSchema> & { model: string; generated_at: string };

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `당신은 아마추어 풋살 동호회의 경기 보고서를 쓰는 기록 담당입니다.
- 독자는 팀원 15명. 단톡방에 올릴 글이므로 친근하지만 정돈된 존댓말(~했습니다, ~네요)을 씁니다.
- 대표가 적은 키워드·메모는 "참고 자료"입니다. 그대로 나열하지 말고 문장으로 녹여 쓰되, 대표가 쓰지 않은 사실을 지어내지 마세요.
- 숫자(골·도움·쿼터·스코어)는 주어진 기록만 사용합니다. 평가가 없는 항목은 언급하지 않습니다.
- 지각·분발필요 같은 부정적 키워드는 비꼬지 말고 가볍게, 다음을 기대하는 톤으로 씁니다.
- 선수 이름은 주어진 표기 그대로 씁니다. 이모지는 쓰지 않습니다.`;

/**
 * 경기 데이터(기록 + 대표 키워드·MVP·총평)를 바탕으로 Claude 가 다듬은 보고서 생성.
 * ANTHROPIC_API_KEY 가 Vercel 환경변수에 있어야 한다.
 */
export async function generateAiReport(d: ReportData): Promise<AiReport> {
  if (!isAiConfigured()) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다. Vercel 환경변수에 추가한 뒤 Redeploy 하세요.");
  const client = new Anthropic();

  const facts = reportToText(d); // 기록·키워드·총평이 모두 들어 있는 사실 요약
  const adminNotes = d.playerLines.map((p) => `- ${p.name} (${p.stats})${p.note ? `: ${p.note}` : ": (키워드 없음)"}${p.isMvp ? " [MVP]" : ""}`).join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(AiReportSchema) }, // 짧은 글쓰기 → low 로 빠르게 (Vercel 함수 시간 제한 고려)
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `아래 경기 기록과 대표 메모를 바탕으로 오늘의 경기 보고서를 써 주세요.

[경기 기록 요약]
${facts}

[대표가 적은 참석자별 키워드·메모]
${adminNotes}

[대표 총평]
${d.memo ?? "(없음)"}

요구사항: headline(20자 이내), summary(3~5문장), playerComments(참석자 전원, 각 1~2문장), nextFocus(1~2문장).`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`AI 가 응답을 거절했습니다${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ""}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("AI 응답이 길이 제한에 걸렸습니다. 다시 시도해 주세요.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
  return { ...parsed, model: response.model, generated_at: new Date().toISOString() };
}
