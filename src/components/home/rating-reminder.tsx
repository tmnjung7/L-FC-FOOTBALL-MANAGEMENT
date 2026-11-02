import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/date";
import type { PendingRating } from "@/lib/queries/home";

/** 모임 종료 후 평점·피드백 입력 알림 카드 (입력 화면은 화면 5에서 구현) */
export function RatingReminder({ pending }: { pending: PendingRating[] }) {
  if (pending.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {pending.map(({ match, hoursLeft }) => (
        <Card key={match.id} className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Star className="size-6 shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold">{formatDateShort(match.match_date)} 모임 평점 남기기</p>
                <p className="text-muted-foreground text-xs">마감까지 약 {hoursLeft}시간</p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={`/matches/${match.id}/rate`}>입력</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
