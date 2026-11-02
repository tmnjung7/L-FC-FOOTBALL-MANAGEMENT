"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BoardJson } from "@/lib/tactics/board-types";
import type { Json, MatchFormat, TacticCategory } from "@/types/database";

export type ActionResult = { ok: true; id?: string } | { error: string };

export type TacticInput = { name: string; format: MatchFormat; category: TacticCategory; description: string | null; board: BoardJson };

function friendly(message: string) {
  return message.includes("row-level security") ? "전술 저장은 관리자(lfc1·lfc2) 로그인 후 가능합니다." : message;
}

export async function createTactic(input: TacticInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "전술 저장은 관리자만 할 수 있습니다." };
  if (!input.name.trim()) return { error: "전술 이름을 입력해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tactics")
    .insert({ name: input.name.trim(), format: input.format, category: input.category, description: input.description?.trim() || null, board_json: input.board as unknown as Json })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  revalidatePath("/tactics");
  return { ok: true, id: data.id };
}

export async function updateTactic(id: string, input: TacticInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "전술 수정은 관리자만 할 수 있습니다." };
  if (!input.name.trim()) return { error: "전술 이름을 입력해 주세요." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tactics")
    .update({ name: input.name.trim(), format: input.format, category: input.category, description: input.description?.trim() || null, board_json: input.board as unknown as Json })
    .eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/tactics");
  return { ok: true, id };
}

export async function deleteTactic(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "전술 삭제는 관리자만 할 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("tactics").delete().eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/tactics");
  return { ok: true };
}

export async function toggleFavorite(id: string, value: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "즐겨찾기는 관리자만 바꿀 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("tactics").update({ is_favorite: value }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/tactics");
  return { ok: true };
}
