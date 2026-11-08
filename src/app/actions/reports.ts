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
