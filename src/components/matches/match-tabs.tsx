import Link from "next/link";
import { cn } from "@/lib/utils";

export type MatchTab = "attendance" | "games" | "events" | "report";

const TABS: { key: MatchTab; label: string }[] = [
  { key: "attendance", label: "출석" },
  { key: "games", label: "쿼터" },
  { key: "events", label: "득점" },
];

/** 모임 상세 상단 탭 (URL ?tab= 으로 상태 유지, 서버 렌더링) */
export function MatchTabs({ matchId, active, counts }: { matchId: string; active: MatchTab; counts?: Partial<Record<MatchTab, number>> }) {
  return (
    <nav className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1" aria-label="모임 상세 탭">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/matches/${matchId}?tab=${t.key}`}
          scroll={false}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "flex h-10 items-center justify-center gap-1 rounded-md text-sm font-medium transition-colors",
            active === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {counts?.[t.key] != null && <span className="text-muted-foreground text-xs">{counts[t.key]}</span>}
        </Link>
      ))}
    </nav>
  );
}
