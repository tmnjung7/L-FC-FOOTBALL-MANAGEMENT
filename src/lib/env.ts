/**
 * 환경변수가 비어 있는지 한 곳에서 확인.
 * 1단계에서는 경고만 하고, 로그인/데이터 연결은 2~3단계에서 붙인다.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export const isSupabaseConfigured =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
