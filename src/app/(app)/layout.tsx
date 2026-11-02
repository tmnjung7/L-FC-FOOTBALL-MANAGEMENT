import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** 로그인 후 보이는 탭 화면들의 공통 레이아웃 (하단 탭 포함) */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
