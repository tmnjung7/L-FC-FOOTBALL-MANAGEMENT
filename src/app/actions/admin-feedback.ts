"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AdminFeedbackInput = {
  notes: { player_id: string; note: string }[]; // 참석자별 키워드·메모 (attendance.note)
  mvp_player_id: string | null; // 대표 지정 MVP
  memo: string | null; // 경기 총평
};

/** 보고서 테이블(match_reports.summary_json.admin_input)에 저장되는 대표 입력 */
export type AdminInput = { mvp_player_id: string | null; memo: string | null; updated_at: string };

export async function getAdminInput(matchId: string): Promise<AdminInput | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("match_reports").select("summary_json").eq("match_id", matchId).maybeSingle();
  const j = data?.summary_json as { admin_input?: AdminInput } | null;
  return j?.admin_input ?? null;
}

/** 대표(lfc1·lfc2)만: 참석자별 피드백 + MVP + 총평 한 번에 저장 */
export async function saveAdminFeedback(matchId: string, input: AdminFeedbackInput): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "경기 피드백 작성은 관리자(lfc1·lfc2)만 할 수 있습니다." };
  const supabase = await createClient();

  // 1) 선수별 비고 (출석 행이 있는 선수만)
  for (const n of input.notes) {
    const note = n.note.trim().slice(0, 200) || null;
    const { error } = await supabase.from("attendance").update({ note }).eq("match_id", matchId).eq("player_id", n.player_id);
    if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다. 다시 로그인해 주세요." : error.message };
  }

  // 2) MVP·총평 → match_reports.summary_json.admin_input (기존 내용 보존)
  const { data: existing } = await supabase.from("match_reports").select("summary_json").eq("match_id", matchId).maybeSingle();
  const prev = (existing?.summary_json as Record<string, unknown> | null) ?? {};
  const admin_input: AdminInput = { mvp_player_id: input.mvp_player_id, memo: input.memo?.trim().slice(0, 500) || null, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("match_reports")
    .upsert({ match_id: matchId, summary_json: { ...prev, admin_input } as unknown as Json }, { onConflict: "match_id" });
  if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다 (관리자 전용)." : error.message };

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/feedback`);
  revalidatePath("/");
  return { ok: true };
}
