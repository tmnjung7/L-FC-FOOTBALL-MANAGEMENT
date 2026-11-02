import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** 환경변수(Supabase URL/Key)가 없을 때 보이는 안내 */
export function SetupNotice() {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <CardContent className="flex gap-3">
        <AlertTriangle className="size-6 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold">Supabase 연결이 아직 설정되지 않았습니다</p>
          <p className="text-muted-foreground mt-1">
            Vercel → Settings → Environment Variables 에 <code>NEXT_PUBLIC_SUPABASE_URL</code> 과{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를 넣고 Redeploy 하면 로그인과 데이터가 동작합니다.
            (로컬은 <code>.env.local</code>)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
