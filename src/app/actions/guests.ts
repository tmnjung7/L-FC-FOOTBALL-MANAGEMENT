"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * 용병 추가: 이름만 받아 players(is_guest=true)에 만들고(같은 이름 용병이 있으면 재사용),
 * 그 모임의 출석(present)에 넣는다. scorer 이상.
 */
export async function addGuestToMatch(matchId: string, name: string): Promise<{ ok: true; player_id: string } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "용병 추가는 대표 계정 로그인 후 가능합니다." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "용병 이름을 입력해 주세요." };
  if (clean.length > 20) return { error: "이름은 20자 이내로 입력해 주세요." };
  const supabase = await createClient();

  // 같은 이름 용병 재사용 (없으면 생성)
  const { data: existing, error: e0 } = await supabase.from("players").select("id").eq("is_guest", true).eq("name", clean).maybeSingle();
  if (e0 && /is_guest/i.test(e0.message)) return { error: "데이터베이스 업데이트가 필요합니다: supabase/migrations/0007_guest_players.sql 을 실행해 주세요." };
  let playerId = existing?.id ?? null;
  if (!playerId) {
    const { data, error } = await supabase.from("players").insert({ name: clean, is_guest: true, is_active: true, preferred_position: "ANY" }).select("id").single();
    if (error) return { error: error.message.includes("row-level security") ? "용병 등록 권한이 없습니다 (관리자 lfc1·lfc2 로 로그인해 주세요)." : error.message };
    playerId = data.id;
  }
  const { error: e2 } = await supabase.from("attendance").upsert({ match_id: matchId, player_id: playerId, status: "present" }, { onConflict: "match_id,player_id" });
  if (e2) return { error: e2.message.includes("row-level security") ? "출석 추가 권한이 없습니다." : e2.message };

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/players");
  return { ok: true, player_id: playerId };
}
