"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeamSide } from "@/types/database";

export type ActionResult = { ok: true; id?: string } | { error: string };

export type GoalInput = {
  team: TeamSide; // 득점이 올라가는 팀
  scorer_id: string;
  assist_id: string | null;
  minute: number | null;
  is_own_goal: boolean; // true 면 scorer 는 상대팀 선수
};

function friendly(message: string): string {
  if (message.includes("row-level security")) return "득점 입력은 대표 계정 로그인 후 가능합니다.";
  if (message.includes("events_check")) return "자책골에는 어시스트를 넣을 수 없고, 득점자와 어시스트는 달라야 합니다.";
  return message;
}

/** 규칙: 쿼터 스코어는 항상 events 건수와 같아야 한다 (CLAUDE.md 9절). 득점 추가/삭제 뒤 반드시 호출 */
async function recomputeScore(gameId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("team").eq("game_id", gameId);
  const a = (data ?? []).filter((e) => e.team === "A").length;
  const b = (data ?? []).filter((e) => e.team === "B").length;
  await supabase.from("games").update({ team_a_score: a, team_b_score: b }).eq("id", gameId);
}

function revalidate(matchId: string, gameId: string) {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/games/${gameId}`);
  revalidatePath("/");
}

export async function addGoal(matchId: string, gameId: string, input: GoalInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "득점 입력은 대표 계정 로그인 후 가능합니다." };
  if (!input.scorer_id) return { error: "득점자를 골라 주세요." };
  if (input.minute != null && (input.minute < 0 || input.minute > 60)) return { error: "분은 0~60 사이여야 합니다." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      game_id: gameId,
      team: input.team,
      scorer_id: input.scorer_id,
      assist_id: input.is_own_goal ? null : input.assist_id || null,
      minute: input.minute,
      is_own_goal: input.is_own_goal,
    })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  await recomputeScore(gameId);
  revalidate(matchId, gameId);
  return { ok: true, id: data.id };
}

export async function deleteGoal(matchId: string, gameId: string, eventId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "권한이 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { error: friendly(error.message) };
  await recomputeScore(gameId);
  revalidate(matchId, gameId);
  return { ok: true };
}
