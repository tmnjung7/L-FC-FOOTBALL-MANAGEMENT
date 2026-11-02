import type { PlayerRow } from "@/types/database";
import { cn } from "@/lib/utils";

/** 선수별 출전 쿼터 수 미니 바 — 누가 많이 쉬었는지 한눈에 (다음 편성 참고) */
export function QuarterCountBar({ attendees, quartersByPlayer, totalGames }: { attendees: PlayerRow[]; quartersByPlayer: Map<string, number>; totalGames: number }) {
  if (attendees.length === 0 || totalGames === 0) return null;
  const rows = attendees.map((p) => ({ p, n: quartersByPlayer.get(p.id) ?? 0 })).sort((a, b) => a.n - b.n || a.p.name.localeCompare(b.p.name));
  const max = Math.max(totalGames, 1);
  const min = rows[0]?.n ?? 0;
  return (
    <div className="bg-card rounded-xl border px-3 py-2 shadow-sm">
      <p className="text-muted-foreground mb-1 text-xs font-semibold">출전 쿼터 수 (적은 순) · 총 {totalGames}쿼터</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        {rows.map(({ p, n }) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className={cn("w-14 shrink-0 truncate", n === min && "text-amber-600 font-semibold")}>{p.name}</span>
            <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
              <span className={cn("block h-full rounded-full", n === min ? "bg-amber-500" : "bg-primary")} style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-4 text-right tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
