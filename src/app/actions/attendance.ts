"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RsvpStatus = "present" | "excused";

/**
 * 예정 모임에 참석/불참 응답. 본인 선수 행만 쓸 수 있다 (RLS 0002 정책).
 */
export async function rsvp(matchId: string, status: RsvpStatus): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.user) return { error: "로그인이 필요합니다." };
  if (!viewer.player) return { error: "먼저 홈에서 내 이름을 골라 주세요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { match_id: matchId, player_id: viewer.player.id, status },
      { onConflict: "match_id,player_id" },
    );
  if (error) {
    return { error: error.message.includes("row-level security") ? "이 모임은 더 이상 응답을 바꿀 수 없습니다." : error.message };
  }
  revalidatePath("/");
  return { ok: true };
}
