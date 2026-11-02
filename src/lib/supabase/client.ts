"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)에서 쓰는 Supabase 클라이언트.
 * anon key는 공개되어도 되는 키이며, 실제 권한은 RLS(2단계)가 통제한다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
