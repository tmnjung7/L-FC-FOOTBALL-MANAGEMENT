import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { periodReportToText, type PeriodReportData } from "@/lib/report/period-text";

export const PeriodAiSchema = z.object({
  headline: z.string().describe("기간 결산 한 줄 제목, 20자 이내"),
  summary: z.string().describe("기간 총평 4~6문장. 전적·득점·출석·공평한 출전 등을 자연스럽게. 숫자는 주어진 것만"),
  highlights: z.array(z.string()).min(2).max(5).describe("기억할 만한 포인트 2~5개, 각 한 문장"),
  nextFocus: z.string().describe("다음 달/분기 목표 1~2문장"),
});

const SYSTEM = `당신은 아마추어 풋살 동호회의 월간·분기·연간 결산 리포트를 쓰는 기록 담당입니다.
- 독자는 팀원 15명. 단톡방에 올릴 글이므로 친근하지만 정돈된 존댓말을 씁니다.
- 주어진 집계 숫자만 사용하고, 없는 사실을 지어내지 않습니다. 지각·노쇼는 비꼬지 않고 가볍게 언급합니다.
- 선수 이름은 주어진 표기 그대로. 이모지는 쓰지 않습니다.`;

export async function generatePeriodAi(d: PeriodReportData) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다.");
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 3000,
    output_config: { effort: "low", format: zodOutputFormat(PeriodAiSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `아래 집계를 바탕으로 ${d.period.label} 결산 리포트를 써 주세요.\n\n${periodReportToText(d)}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("AI 가 응답을 거절했습니다.");
  if (!response.parsed_output) throw new Error("AI 응답을 해석하지 못했습니다.");
  return { ...response.parsed_output, generated_at: new Date().toISOString() };
}
