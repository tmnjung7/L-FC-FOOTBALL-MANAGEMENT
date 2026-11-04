"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RsvpStatus = "yes" | "no";

function friendlyAttendanceError(message: string): string {
  if (/rsvp/i.test(message) && /could not find|does not exist|schema cache/i.test(message))
    return "데이터베이스 업데이트가 필요합니다: supabase/migrations/0004_rsvp.sql 을 Supabase SQL Editor 에서 실행해 주세요.";
  if (message.includes("row-level security")) return `권한 오류(RLS): 대표 계정 로그인 상태인지 확인해 주세요. [${message}]`;
  if (/Invalid API key|JWT/i.test(message)) return `Supabase 키 오류: Vercel 환경변수의 키가 현재 프로젝트 것인지 확인해 주세요. [${message}]`;
  return `저장 실패: ${message}`;
}

/**
 * 예정 모임에 사전 투표(참석/불참). 홈에서 고른 "내 이름"으로 기록 (RLS 0004 정책).
 * 당일 출석(status)은 건드리지 않는다.
 */
export async function rsvp(matchId: string, answer: RsvpStatus): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.player) return { error: "먼저 홈에서 내 이름을 골라 주세요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { match_id: matchId, player_id: viewer.player.id, rsvp: answer },
      { onConflict: "match_id,player_id" },
    );
  if (error) return { error: friendlyAttendanceError(error.message) };
  revalidatePath("/");
  return { ok: true };
}

export type AttendanceRowInput = {
  player_id: string;
  rsvp: "yes" | "no" | null; // 사전 투표
  status: "present" | "late" | "absent" | "excused" | null; // 당일 확정
  late_minutes: number | null;
  note?: string | null;
};

/** 출석 탭 "한 번에 저장". scorer 이상. 투표·당일 둘 다 비어 있으면 행 삭제 */
export async function saveAttendance(matchId: string, rows: AttendanceRowInput[]): Promise<{ ok: true } | { error: string }> {
  try {
    return await saveAttendanceInner(matchId, rows);
  } catch (e) {
    return { error: `저장 중 오류: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function saveAttendanceInner(matchId: string, rows: AttendanceRowInput[]): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.user) return { error: "로그인이 풀렸습니다. 다시 로그인해 주세요." };
  if (!viewer.canScore) return { error: `출석 저장 권한이 없습니다 (현재 역할: ${viewer.role ?? "없음"}). lfc1·lfc2·lfc3 로 로그인했는지, 0003 SQL 적용 후 재로그인했는지 확인해 주세요.` };
  const supabase = await createClient();

  const toUpsert = rows
    .filter((r) => r.status !== null || r.rsvp !== null)
    .map((r) => ({
      match_id: matchId,
      player_id: r.player_id,
      rsvp: r.rsvp,
      status: r.status,
      late_minutes: r.status === "late" ? (r.late_minutes ?? null) : null,
      note: r.note?.trim() || null,
    }));
  const toDelete = rows.filter((r) => r.status === null && r.rsvp === null).map((r) => r.player_id);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("attendance").upsert(toUpsert, { onConflict: "match_id,player_id" });
    if (error) return { error: friendlyAttendanceError(error.message) };
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("attendance").delete().eq("match_id", matchId).in("player_id", toDelete);
    if (error) return { error: error.message };
  }
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/");
  return { ok: true };
}
