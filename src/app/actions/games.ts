"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PositionType, TeamSide } from "@/types/database";

export type ActionResult = { ok: true; id?: string } | { error: string };

function friendly(message: string): string {
  if (message.includes("row-level security")) return "기록 입력은 대표 계정(lfc1·lfc2·lfc3) 로그인 후 가능합니다.";
  return message;
}

function revalidate(matchId: string, gameId?: string) {
  revalidatePath(`/matches/${matchId}`);
  if (gameId) revalidatePath(`/matches/${matchId}/games/${gameId}`);
  revalidatePath("/");
}

export type LineupRow = { player_id: string; team: TeamSide; position: PositionType | null };

/**
 * 쿼터 추가. 번호는 자동(마지막+1), 시간은 팀 설정 기본값.
 * copyPrevious 면 직전 쿼터의 편성(A/B/포지션)을 그대로 복사한다.
 */
export async function createGame(matchId: string, opts: { copyPrevious: boolean; durationMin?: number }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "쿼터 추가는 대표 계정 로그인 후 가능합니다." };
  const supabase = await createClient();

  const [{ data: last }, { data: settings }] = await Promise.all([
    supabase.from("games").select("id, game_number").eq("match_id", matchId).order("game_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("team_settings").select("default_quarter_min").eq("id", 1).maybeSingle(),
  ]);
  const nextNumber = (last?.game_number ?? 0) + 1;
  const duration = opts.durationMin ?? settings?.default_quarter_min ?? 12;

  const { data: game, error } = await supabase
    .from("games")
    .insert({ match_id: matchId, game_number: nextNumber, duration_min: duration })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };

  if (opts.copyPrevious && last) {
    const { data: prev } = await supabase.from("game_players").select("player_id, team, position").eq("game_id", last.id);
    if (prev?.length) {
      const { error: e2 } = await supabase.from("game_players").insert(prev.map((r) => ({ ...r, game_id: game.id })));
      if (e2) return { error: friendly(e2.message) };
    }
  }
  revalidate(matchId, game.id);
  return { ok: true, id: game.id };
}

/** 쿼터 설정 수정 (시간·전술) */
export async function updateGame(matchId: string, gameId: string, patch: { duration_min?: number; tactic_id?: string | null }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "권한이 없습니다." };
  if (patch.duration_min != null && (patch.duration_min < 1 || patch.duration_min > 60)) return { error: "쿼터 시간은 1~60분이어야 합니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("games").update(patch).eq("id", gameId);
  if (error) return { error: friendly(error.message) };
  revalidate(matchId, gameId);
  return { ok: true, id: gameId };
}

/** 쿼터 삭제 (득점·편성도 함께 삭제) 후 번호 재정렬 */
export async function deleteGame(matchId: string, gameId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "권한이 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) return { error: friendly(error.message) };
  // 재정렬: 1..N (unique 제약 충돌을 피하려고 큰 수로 옮긴 뒤 다시 매김)
  const { data: rest } = await supabase.from("games").select("id, game_number").eq("match_id", matchId).order("game_number");
  if (rest) {
    for (const [i, g] of rest.entries()) if (g.game_number !== i + 1) await supabase.from("games").update({ game_number: 1000 + i }).eq("id", g.id);
    for (const [i, g] of rest.entries()) if (g.game_number !== i + 1) await supabase.from("games").update({ game_number: i + 1 }).eq("id", g.id);
  }
  revalidate(matchId);
  return { ok: true };
}

/** 편성 전체 교체 (행이 없는 참석자 = 휴식) */
export async function setLineup(matchId: string, gameId: string, rows: LineupRow[]): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "편성 수정은 대표 계정 로그인 후 가능합니다." };
  const supabase = await createClient();
  const { error: e1 } = await supabase.from("game_players").delete().eq("game_id", gameId);
  if (e1) return { error: friendly(e1.message) };
  if (rows.length > 0) {
    const { error: e2 } = await supabase.from("game_players").insert(rows.map((r) => ({ game_id: gameId, player_id: r.player_id, team: r.team, position: r.position })));
    if (e2) return { error: friendly(e2.message) };
  }
  revalidate(matchId, gameId);
  return { ok: true, id: gameId };
}

/** 직전 쿼터 편성 복사 */
export async function copyPreviousLineup(matchId: string, gameId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "권한이 없습니다." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("games").select("game_number").eq("id", gameId).single();
  if (!cur) return { error: "쿼터를 찾을 수 없습니다." };
  const { data: prev } = await supabase
    .from("games")
    .select("id")
    .eq("match_id", matchId)
    .lt("game_number", cur.game_number)
    .order("game_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return { error: "복사할 직전 쿼터가 없습니다." };
  const { data: rows } = await supabase.from("game_players").select("player_id, team, position").eq("game_id", prev.id);
  return setLineup(matchId, gameId, (rows ?? []) as LineupRow[]);
}
