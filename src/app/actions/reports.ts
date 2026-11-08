"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildReport } from "@/lib/report/build";
import type { Json } from "@/types/database";

/** 보고서 확정 저장 (admin). 현재 데이터로 스냅샷을 match_reports 에 upsert */
export async function saveMatchReport(matchId: string): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "보고서 저장은 관리자(lfc1·lfc2)만 할 수 있습니다." };
  const data = await buildReport(matchId);
  if (!data) return { error: "모임을 찾을 수 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("match_reports")
    .upsert({ match_id: matchId, summary_json: data as unknown as Json, narrative: data.narrative.join(" "), generated_at: new Date().toISOString() }, { onConflict: "match_id" });
  if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다." : error.message };
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

/** AI(Claude)로 보고서 다듬어 쓰기 (admin). 결과는 match_reports.summary_json.ai 에 저장 */
export async function generateAiMatchReport(matchId: string): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "AI 보고서 생성은 관리자(lfc1·lfc2)만 할 수 있습니다." };
  const data = await buildReport(matchId);
  if (!data) return { error: "모임을 찾을 수 없습니다." };
  if (data.attendeeCount === 0) return { error: "출석 체크된 참석자가 없습니다. 출석을 먼저 저장해 주세요." };
  try {
    const { generateAiReport } = await import("@/lib/report/ai");
    const ai = await generateAiReport(data);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("match_reports").select("summary_json").eq("match_id", matchId).maybeSingle();
    const prev = (existing?.summary_json as Record<string, unknown> | null) ?? {};
    const { error } = await supabase.from("match_reports").upsert({ match_id: matchId, summary_json: { ...prev, ai } as unknown as Json, narrative: ai.summary }, { onConflict: "match_id" });
    if (error) return { error: error.message };
    revalidatePath(`/matches/${matchId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/401|authentication|invalid x-api-key/i.test(msg)) return { error: "Anthropic API 키가 올바르지 않습니다. Vercel 환경변수 ANTHROPIC_API_KEY 를 확인하세요." };
    if (/429|rate limit/i.test(msg)) return { error: "AI 요청이 몰렸습니다. 잠시 후 다시 시도해 주세요." };
    return { error: `AI 보고서 생성 실패: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// 결산 리포트 (월/분기/연/직접 기간)
// ---------------------------------------------------------------------------
import { buildPeriodReport } from "@/lib/report/period";
import { resolvePeriod } from "@/lib/queries/stats";

/** 결산 리포트 저장(스냅샷) + 선택적으로 AI 다듬기. admin */
export async function savePeriodReport(key: string, from: string | undefined, to: string | undefined, opts: { withAi: boolean }): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "결산 리포트 저장은 관리자(lfc1·lfc2)만 할 수 있습니다." };
  const period = resolvePeriod(key, from, to);
  if (!period.from || !period.to) return { error: "'전체' 기간은 저장할 수 없습니다. 월/분기/연 또는 직접 기간을 고르세요." };
  const data = await buildPeriodReport(period);
  if (data.stats.matchCount === 0) return { error: "이 기간에 완료된 모임이 없습니다." };
  let ai = data.ai;
  if (opts.withAi) {
    try {
      const { generatePeriodAi } = await import("@/lib/report/period-ai");
      ai = await generatePeriodAi(data);
    } catch (e) {
      return { error: `AI 작성 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const supabase = await createClient();
  const { stats, tops, narrative } = data;
  const summary = { ai, tops, totals: stats.totals, opponents: stats.opponents, matchCount: stats.matchCount, players: stats.players, months: stats.months } as unknown as Json;
  const { error } = await supabase
    .from("period_reports")
    .upsert(
      { period_type: period.type, period_start: period.from, period_end: period.to, title: `${period.label} 결산`, summary_json: summary, narrative: ai?.summary ?? narrative.join(" "), generated_at: new Date().toISOString() },
      { onConflict: "period_type,period_start,period_end" },
    );
  if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다." : error.message };
  revalidatePath("/stats/report");
  return { ok: true };
}
