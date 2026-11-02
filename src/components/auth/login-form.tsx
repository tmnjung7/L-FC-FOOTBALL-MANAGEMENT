"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/** Supabase 계정은 이메일이 필요하므로, 아이디(lfc1)만 입력하면 고정 도메인을 붙인다 */
const LOGIN_DOMAIN = process.env.NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN ?? "lfc.team";
function toEmail(id: string) {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_DOMAIN}`;
}

/**
 * 대표 계정 로그인 (아이디 + 비밀번호). 로그인 상태는 브라우저에 유지된다.
 * 일반 팀원은 로그인 없이 조회·참석 응답·평점 입력이 가능하다.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(loginId),
      password,
    });

    if (error) {
      setLoading(false);
      setMessage(
        error.message.includes("Invalid login credentials")
          ? "아이디 또는 비밀번호가 맞지 않습니다."
          : `로그인에 실패했습니다. (${error.message})`,
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginId">아이디</Label>
        <Input
          id="loginId"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          placeholder="lfc1"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          aria-invalid={!!message}
        />
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
      <Button type="submit" size="lg" disabled={loading || !loginId.trim() || !password}>
        <LogIn />
        {loading ? "로그인 중…" : "로그인"}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        대표가 아니면 로그인 없이 뒤로 가서 그대로 쓰시면 됩니다.
      </p>
    </form>
  );
}
