import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** 대표 계정으로 로그인은 됐지만 app_metadata.role 이 없을 때 (SQL 0003 미실행 또는 재로그인 전) */
export function NoRoleNotice({ email }: { email: string }) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <CardContent className="flex gap-3">
        <ShieldAlert className="size-6 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold">로그인은 됐지만 아직 권한이 없습니다 ({email})</p>
          <ol className="text-muted-foreground mt-1 list-decimal space-y-0.5 pl-4">
            <li>Supabase SQL Editor 에서 <code>supabase/migrations/0003_auto_roles.sql</code> 을 한 번 실행</li>
            <li>앱에서 로그아웃 → 다시 로그인 (권한은 로그인할 때 토큰에 담깁니다)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
