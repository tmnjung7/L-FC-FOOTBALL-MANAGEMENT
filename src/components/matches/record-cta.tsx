import Link from "next/link";
import { Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewGameButton } from "@/components/matches/new-game-button";
import type { GameFull } from "@/lib/queries/games";

type Props = { matchId: string; games: GameFull[]; canScore: boolean; attendeeCount: number; status: "scheduled" | "done" | "cancelled" };

/**
 * 모임 화면 맨 위 "경기 기록하기" 한 버튼.
 * 쿼터가 없으면 Q1 을 만들고 점수판으로, 있으면 마지막 쿼터 점수판으로 바로 간다.
 */
export function RecordCta({ matchId, games, canScore, attendeeCount, status }: Props) {
  if (status === "cancelled") return null;
  const last = games[games.length - 1];
  const totalA = games.reduce((n, g) => n + g.game.team_a_score, 0);
  const totalB = games.reduce((n, g) => n + g.game.team_b_score, 0);

  if (!canScore) {
    if (!last) return null;
    return (
      <Link href={`/matches/${matchId}/games/${last.game.id}`} className="bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm">
        <span className="flex items-center gap-2 text-sm font-medium"><Radio className="size-4 text-red-500" /> 지금 Q{last.game.game_number} 점수판 보기</span>
        <span className="text-lg font-bold tabular-nums"><span className="text-team-a">{last.game.team_a_score}</span> : <span className="text-team-b">{last.game.team_b_score}</span></span>
      </Link>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-col gap-2">
        {!last ? (
          <>
            <p className="text-sm font-semibold">경기 기록 시작</p>
            <p className="text-muted-foreground text-xs">
              {attendeeCount === 0 ? "먼저 아래 출석 탭에서 참석자를 체크한 뒤 시작하세요." : `참석 ${attendeeCount}명 · 1쿼터를 만들고 편성 → 타이머 → 골 순서로 기록합니다.`}
            </p>
            <NewGameButton matchId={matchId} hasPrevious={false} size="lg" label="▶ 1쿼터 시작하기" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">경기 기록 중 · {games.length}쿼터</p>
              <p className="text-muted-foreground text-xs">합계 A {totalA} : {totalB} B</p>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button asChild size="lg" className="h-14 text-base">
                <Link href={`/matches/${matchId}/games/${last.game.id}`}><Play /> Q{last.game.game_number} 점수판 열기</Link>
              </Button>
              <NewGameButton matchId={matchId} hasPrevious size="lg" label="다음 쿼터" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
