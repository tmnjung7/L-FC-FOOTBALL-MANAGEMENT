import { DatabaseZap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MigrationStatus } from "@/lib/supabase/migrations-check";

/** 적용 안 된 SQL 이 있을 때 (관리자 화면·로그인 화면) */
export function DbUpdateNotice({ missing }: { missing: MigrationStatus[] }) {
  if (missing.length === 0) return null;
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <CardContent className="flex gap-3">
        <DatabaseZap className="size-6 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold">데이터베이스 업데이트가 필요합니다</p>
          <p className="text-muted-foreground mt-1">아래 SQL 파일을 순서대로 Supabase SQL Editor 에 붙여넣고 Run 하세요. (저장소 <code>supabase/migrations/</code>)</p>
          <ul className="mt-1 list-disc pl-4">
            {missing.map((m) => (
              <li key={m.file}><code>{m.file}</code> <span className="text-muted-foreground">— {m.label}</span></li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-1 text-xs">적용 전에는 관련 기능(예: 참석 투표, 출석 저장)에서 오류가 납니다.</p>
        </div>
      </CardContent>
    </Card>
  );
}
