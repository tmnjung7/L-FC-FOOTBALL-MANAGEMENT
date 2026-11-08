"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 화면이 보이는 동안 주기적으로 서버 데이터를 다시 받아온다 (타이머·스코어·편성 동기화).
 * 바텀시트가 열려 있거나 탭이 백그라운드면 건너뛴다.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (document.querySelector("[data-slot='drawer-content'][data-state='open']")) return;
      router.refresh();
    }, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, intervalMs]);
  return null;
}
