import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { POSITION_LABEL, type PlayerRow, type PlayerSeasonStatsRow } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { players: PlayerRow[]; stats: Map<string, PlayerSeasonStatsRow> };

function PlayerRowItem({ p, s }: { p: PlayerRow; s?: PlayerSeasonStatsRow }) {
  return (
    <li>
      <Link
        href={`/players/${p.id}`}
        className={cn("hover:bg-accent flex min-h-16 items-center gap-3 px-4 py-2", !p.is_active && "opacity-60")}
      >
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {p.jersey_number ?? <UserRound className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{p.name}</span>
            {p.nickname && <span className="text-muted-foreground truncate text-xs">{p.nickname}</span>}
          </span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <Badge variant="outline" className="h-5">{POSITION_LABEL[p.preferred_position]}</Badge>
            {s && s.matches_played > 0 ? (
              <span>
                {s.matches_played}회 · {s.goals}골 {s.assists}도움
                {s.avg_rating != null && ` · 평점 ${Number(s.avg_rating).toFixed(1)}`}
              </span>
            ) : (
              <span>기록 없음</span>
            )}
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      </Link>
    </li>
  );
}

/** 선수 목록. 활성 선수 먼저, 비활성 선수는 접힌 섹션 */
export function PlayerList({ players, stats }: Props) {
  const active = players.filter((p) => p.is_active);
  const inactive = players.filter((p) => !p.is_active);

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <h2 className="text-muted-foreground border-b px-4 py-2 text-xs font-semibold">활동 선수 {active.length}명</h2>
        {active.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">등록된 선수가 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {active.map((p) => (
              <PlayerRowItem key={p.id} p={p} s={stats.get(p.id)} />
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <details className="bg-card group overflow-hidden rounded-xl border shadow-sm">
          <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-xs font-semibold select-none">
            비활성 선수 {inactive.length}명
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="divide-y border-t">
            {inactive.map((p) => (
              <PlayerRowItem key={p.id} p={p} s={stats.get(p.id)} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
