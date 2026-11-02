"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PLAYER_COOKIE, PLAYER_COOKIE_MAX_AGE } from "@/lib/identity";
import { createClient } from "@/lib/supabase/server";

/** "나는 OO입니다" 선택 → 쿠키 저장 → 홈으로 */
export async function selectPlayer(playerId: string, next = "/") {
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("id").eq("id", playerId).eq("is_active", true).maybeSingle();
  if (!data) redirect("/whoami?error=1");

  const cookieStore = await cookies();
  cookieStore.set(PLAYER_COOKIE, playerId, {
    path: "/",
    maxAge: PLAYER_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

/** 선택 해제 (다른 사람 휴대폰에서 로그인했을 때 등) */
export async function clearPlayer() {
  const cookieStore = await cookies();
  cookieStore.delete(PLAYER_COOKIE);
  revalidatePath("/", "layout");
  redirect("/whoami");
}
