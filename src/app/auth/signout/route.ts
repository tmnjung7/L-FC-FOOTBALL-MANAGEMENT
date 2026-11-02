import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 로그아웃 (POST). 홈 상단 버튼의 <form method="post"> 에서 호출 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = forwardedHost && process.env.NODE_ENV !== "development" ? `https://${forwardedHost}` : new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
