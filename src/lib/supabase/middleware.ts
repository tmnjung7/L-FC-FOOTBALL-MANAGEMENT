import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * 모든 요청에서 Supabase 세션 쿠키를 갱신한다.
 * 오픈형이라 로그인을 강제하지 않는다. 기록 입력 권한은 RLS 가 admin 계정에만 준다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // 환경변수가 없으면(아직 설정 전) 그냥 통과시켜 안내 화면이 뜨게 한다
  if (!isSupabaseConfigured) return response;

  // 로그인 쿠키가 전혀 없는 일반 팀원은 세션 갱신이 필요 없다 → Supabase 왕복 생략 (속도)
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 는 Supabase 서버에 토큰을 검증하므로 getSession() 보다 안전하다
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 이미 로그인한 대표가 /login 에 오면 홈으로
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
