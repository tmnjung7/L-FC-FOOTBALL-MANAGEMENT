import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * 앱 공통 틀: 콘텐츠 영역 + 하단 탭.
 * 콘텐츠는 하단 탭에 가려지지 않도록 pb-safe-nav 만큼 아래 여백을 둔다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="pb-safe-nav mx-auto w-full max-w-screen-md flex-1 px-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
