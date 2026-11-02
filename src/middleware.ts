import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 정적 파일·PWA 파일은 제외
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|swe-worker|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
