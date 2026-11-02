"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * 하단 탭 네비게이션.
 * - 항상 화면 아래 고정, iOS 홈 인디케이터 영역(safe-area)만큼 패딩
 * - 각 탭은 최소 44x44px 터치 타깃
 * - 현재 경로의 첫 세그먼트로 활성 탭 판단 (/matches/123 → 경기 탭 활성)
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-screen-md grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
