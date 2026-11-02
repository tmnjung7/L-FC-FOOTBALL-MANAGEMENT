import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/date";
import type { MatchSummaryRow } from "@/types/database";

export function RecentResults({ results }: { results: MatchSummaryRow[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">최근 모임</CardTitle>
        <Link href="/matches" className="text-muted-foreground flex items-center text-sm">
          전체 <ChevronRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {results.length === 0 ? (
          <p className="text-muted-foreground px-4 pb-2 text-sm">아직 끝난 모임이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {results.map((m) => (
              <li key={m.match_id}>
                <Link
                  href={`/matches/${m.match_id}`}
                  className="hover:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{formatDateShort(m.match_date)}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {m.venue || "장소 미정"} · {m.attendee_count}명 · {m.game_count}쿼터
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="teamA">A {m.team_a_wins}승</Badge>
                    <Badge variant="muted">{m.draws}무</Badge>
                    <Badge variant="teamB">B {m.team_b_wins}승</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
