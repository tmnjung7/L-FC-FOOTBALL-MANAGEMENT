import { CheckCircle2, XCircle } from "lucide-react";
import type { Health } from "@/lib/supabase/health";

function Row({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />}
      <span>
        {label}
        {!ok && hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </li>
  );
}

/** 로그인 화면 하단 연결 진단. 전부 초록이면 환경변수 문제는 아님 */
export function HealthNotice({ h }: { h: Health }) {
  const allOk = h.urlLooksValid && h.keyLooksValid && h.reachable === true;
  if (allOk) return null;
  return (
    <div className="bg-muted mt-4 rounded-md px-3 py-2 text-sm">
      <p className="mb-1 font-semibold">연결 진단</p>
      <ul className="space-y-1">
        <Row
          ok={h.urlLooksValid}
          label={`Supabase 주소: ${h.urlHost ?? "(없음 또는 형식 오류)"}`}
          hint="Vercel 환경변수 NEXT_PUBLIC_SUPABASE_URL 은 https://프로젝트ID.supabase.co 형태여야 합니다 (뒤에 / 나 경로 없이)"
        />
        <Row ok={h.keyLooksValid} label="API 키 형식" hint="NEXT_PUBLIC_SUPABASE_ANON_KEY 는 sb_publishable_ 로 시작하는 Publishable key 여야 합니다" />
        <Row
          ok={h.reachable === true}
          label={`서버에서 Supabase 응답: ${h.reachable === null ? "확인 안 함" : h.reachable ? "정상" : `실패${h.detail ? ` (${h.detail})` : ""}`}`}
          hint="실패면 Supabase 프로젝트가 일시정지(Paused) 상태인지 대시보드에서 확인하세요. 값을 고친 뒤에는 Vercel 에서 Redeploy 가 필요합니다"
        />
      </ul>
    </div>
  );
}
