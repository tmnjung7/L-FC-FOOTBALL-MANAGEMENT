"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 화면 안에서 예기치 않은 오류가 나면 "Application error" 대신 이 화면.
 * 원인 문구를 보여주고, 캐시(서비스워커)를 비운 뒤 다시 열 수 있게 한다 (배포 직후 옛 파일 캐시 문제 대응).
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  async function hardReload() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" />
      </div>
      <div>
        <p className="text-lg font-semibold">화면을 표시하는 중 오류가 났습니다</p>
        <p className="text-muted-foreground mt-1 text-sm">아래 문구를 캡처해서 보내 주시면 바로 고칠 수 있습니다.</p>
      </div>
      <pre className="bg-muted max-w-full overflow-x-auto rounded-md px-3 py-2 text-left text-xs whitespace-pre-wrap">
        {error.message || "(메시지 없음)"}
        {error.digest ? `\n[digest: ${error.digest}]` : ""}
      </pre>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline"><RefreshCw /> 다시 시도</Button>
        <Button onClick={hardReload}>캐시 비우고 새로 열기</Button>
      </div>
      <p className="text-muted-foreground text-xs">배포 직후라면 &lsquo;캐시 비우고 새로 열기&rsquo;로 대부분 해결됩니다.</p>
    </div>
  );
}
