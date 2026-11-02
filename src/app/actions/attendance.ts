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

export type AttendanceRowInput = {
  player_id: string;
  status: "present" | "late" | "absent" | "excused" | null; // null = 기록 없음(행 삭제)
  late_minutes: number | null;
  note?: string | null;
};

/** 출석 탭 "한 번에 저장". scorer 이상. null 상태는 행 삭제 */
export async function saveAttendance(matchId: string, rows: AttendanceRowInput[]): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "출석 저장은 대표 계정 로그인 후 가능합니다." };
  const supabase = await createClient();

  const toUpsert = rows
    .filter((r) => r.status !== null)
    .map((r) => ({
      match_id: matchId,
      player_id: r.player_id,
      status: r.status!,
      late_minutes: r.status === "late" ? (r.late_minutes ?? null) : null,
      note: r.note?.trim() || null,
    }));
  const toDelete = rows.filter((r) => r.status === null).map((r) => r.player_id);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("attendance").upsert(toUpsert, { onConflict: "match_id,player_id" });
    if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다. 대표 계정으로 로그인해 주세요." : error.message };
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("attendance").delete().eq("match_id", matchId).in("player_id", toDelete);
    if (error) return { error: error.message };
  }
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/");
  return { ok: true };
}
