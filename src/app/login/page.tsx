import type { Metadata } from "next";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "로그인" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  // 외부 주소로 보내지 않도록 앱 안 경로만 허용
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Image src="/icons/icon.svg" alt="" width={72} height={72} className="rounded-2xl" priority />
        <h1 className="text-2xl font-bold">풋살 매니저</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>대표 로그인</CardTitle>
          <CardDescription>기록 입력(선수·경기·득점)은 대표 계정만 가능합니다. 보기만 할 땐 로그인이 필요 없습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured ? (
            <p className="text-destructive text-sm">
              Supabase 환경변수가 설정되지 않았습니다. README 의 Vercel 환경변수 안내를 확인해 주세요.
            </p>
          ) : (
            <>
              {error && (
                <p className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">
                  로그인 세션이 만료되었습니다. 다시 로그인해 주세요.
                </p>
              )}
              <LoginForm next={safeNext} />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
