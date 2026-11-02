import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { PLAYER_COOKIE } from "@/lib/identity";
import type { PlayerRow } from "@/types/database";

export type Role = "admin" | "scorer";

export type Viewer = {
  /** 로그인한 대표 계정. 오픈형이라 대부분 null */
  user: User | null;
  /** auth.users.app_metadata.role: admin(lfc1·lfc2) / scorer(lfc3) / null */
  role: Role | null;
  /** admin: 선수 등록·전술·보고서·설정까지 전부 */
  isAdmin: boolean;
  /** scorer 이상: 모임 생성, 쿼터·편성, 득점, 출석 확정 */
  canScore: boolean;
  /**
   * "나" 로 간주되는 선수 (참석 응답·평점에 사용).
   * 1순위: 로그인 계정에 직접 연결된 선수(players.user_id)
   * 2순위: "내 이름 선택" 으로 고른 선수(쿠키, 로그인 불필요)
   * 없으면 null → /whoami 로 안내
   */
  player: PlayerRow | null;
  playerSource: "linked" | "cookie" | null;
};

const EMPTY: Viewer = { user: null, role: null, isAdmin: false, canScore: false, player: null, playerSource: null };

export const getViewer = cache(async (): Promise<Viewer> => {
  if (!isSupabaseConfigured) return EMPTY;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawRole = user?.app_metadata?.role;
  const role: Role | null = rawRole === "admin" || rawRole === "scorer" ? rawRole : null;
  const isAdmin = role === "admin";
  const canScore = role === "admin" || role === "scorer";

  if (user) {
    const { data: linked } = await supabase.from("players").select("*").eq("user_id", user.id).maybeSingle();
    if (linked) return { user, role, isAdmin, canScore, player: linked, playerSource: "linked" };
  }

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(PLAYER_COOKIE)?.value;
  if (cookieId) {
    const { data: chosen } = await supabase.from("players").select("*").eq("id", cookieId).eq("is_active", true).maybeSingle();
    if (chosen) return { user, role, isAdmin, canScore, player: chosen, playerSource: "cookie" };
  }
  return { user, role, isAdmin, canScore, player: null, playerSource: null };
});
