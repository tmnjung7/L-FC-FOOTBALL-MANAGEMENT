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
