"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PositionType } from "@/types/database";

export type PlayerInput = {
  name: string;
  nickname: string | null;
  preferred_position: PositionType;
  jersey_number: number | null;
  is_active: boolean;
  joined_at: string; // YYYY-MM-DD
};

export type ActionResult = { ok: true; id?: string } | { error: string };

const POSITIONS: PositionType[] = ["GK", "FIXO", "ALA", "PIVO", "ANY"];

/** 폼 값 검증. 틀리면 한국어 메시지 */
function validate(input: PlayerInput): string | null {
  if (!input.name.trim()) return "이름을 입력해 주세요.";
  if (input.name.trim().length > 20) return "이름은 20자 이내로 입력해 주세요.";
  if (!POSITIONS.includes(input.preferred_position)) return "포지션이 올바르지 않습니다.";
  if (input.jersey_number != null && (input.jersey_number < 0 || input.jersey_number > 99)) return "등번호는 0~99 사이여야 합니다.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.joined_at)) return "가입일 형식이 올바르지 않습니다.";
  return null;
}

function clean(input: PlayerInput) {
  return {
    name: input.name.trim(),
    nickname: input.nickname?.trim() || null,
    preferred_position: input.preferred_position,
    jersey_number: input.jersey_number,
    is_active: input.is_active,
    joined_at: input.joined_at,
  };
}

function friendly(message: string): string {
  if (message.includes("row-level security")) return "선수 등록·수정은 관리자(lfc1, lfc2)만 할 수 있습니다. 로그인 상태를 확인해 주세요.";
  return message;
}

/** 선수 추가 (admin) */
export async function createPlayer(input: PlayerInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "관리자만 선수를 등록할 수 있습니다." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase.from("players").insert(clean(input)).select("id").single();
  if (error) return { error: friendly(error.message) };
  revalidatePath("/players");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

/** 선수 수정 (admin). 삭제는 없고 is_active=false 로 비활성화 */
export async function updatePlayer(id: string, input: PlayerInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "관리자만 선수 정보를 수정할 수 있습니다." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("players").update(clean(input)).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/");
  return { ok: true, id };
}
