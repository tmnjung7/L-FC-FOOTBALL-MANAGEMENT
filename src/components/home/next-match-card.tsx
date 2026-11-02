import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RsvpButtons } from "@/components/home/rsvp-buttons";
import { formatDate, formatTime, relativeDays } from "@/lib/date";
import type { NextMatch } from "@/lib/queries/home";

type Props = { next: NextMatch | null; hasPlayer: boolean };

export function NextMatchCard({ next, hasPlayer }: Props) {
  if (!next) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">다음 모임</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          예정된 모임이 없습니다. 경기 탭에서 모임을 만들 수 있습니다.
        </CardContent>
      </Card>
    );
  }

  const { match, going, notGoing, mine } = next;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">다음 모임</CardTitle>
          <p className="mt-1 text-2xl font-bold">{formatDate(match.match_date)}</p>
        </div>
        <Badge variant="default">{relativeDays(match.match_date)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
          <dt className="flex items-center"><CalendarDays className="size-4" /></dt>
          <dd>{formatTime(match.start_time) || "시간 미정"} · {match.format}</dd>
          <dt className="flex items-center"><MapPin className="size-4" /></dt>
          <dd>{match.venue || "장소 미정"}</dd>
          <dt className="flex items-center"><Users className="size-4" /></dt>
          <dd>
            투표 참석 <span className="text-foreground font-semibold">{going}명</span>
            {notGoing > 0 && <> · 불참 {notGoing}명</>}
          </dd>
        </dl>

        {hasPlayer ? (
          <RsvpButtons matchId={match.id} mine={mine} />
        ) : (
          <Link href="/whoami" className="text-muted-foreground bg-muted block rounded-md px-3 py-2 text-center text-xs underline-offset-4 hover:underline">
            참석 응답을 하려면 먼저 내 이름을 골라 주세요 →
          </Link>
        )}

        <Link href={`/matches/${match.id}`} className="text-primary self-end text-sm font-medium underline-offset-4 hover:underline">
          모임 상세 보기
        </Link>
      </CardContent>
    </Card>
  );
}
