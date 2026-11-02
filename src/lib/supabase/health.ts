import { env, isSupabaseConfigured } from "@/lib/env";

export type Health = {
  configured: boolean;
  urlHost: string | null; // 공개 정보 (anon/publishable 키는 표시하지 않음)
  urlLooksValid: boolean;
  keyLooksValid: boolean;
  reachable: boolean | null; // 서버에서 Supabase Auth 에 핑 성공 여부
  detail: string | null;
};

/** 서버에서 Supabase 연결 상태 점검 (로그인 화면 진단용) */
export async function checkSupabaseHealth(): Promise<Health> {
  if (!isSupabaseConfigured) {
    return { configured: false, urlHost: null, urlLooksValid: false, keyLooksValid: false, reachable: null, detail: "환경변수 없음" };
  }
  let host: string | null = null;
  let urlLooksValid = false;
  try {
    const u = new URL(env.supabaseUrl);
    host = u.host;
    urlLooksValid = u.protocol === "https:" && /\.supabase\.(co|in)$/.test(u.hostname) && (u.pathname === "/" || u.pathname === "");
  } catch {
    urlLooksValid = false;
  }
  const key = env.supabaseAnonKey.trim();
  const keyLooksValid = key.startsWith("sb_publishable_") || key.startsWith("eyJ");

  let reachable: boolean | null = null;
  let detail: string | null = null;
  if (urlLooksValid) {
    try {
      const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      reachable = res.ok;
      if (!res.ok) detail = `HTTP ${res.status}`;
    } catch (e) {
      reachable = false;
      detail = e instanceof Error ? e.message : String(e);
    }
  }
  return { configured: true, urlHost: host, urlLooksValid, keyLooksValid, reachable, detail };
}
