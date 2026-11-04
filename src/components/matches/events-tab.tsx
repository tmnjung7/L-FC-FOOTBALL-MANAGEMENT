import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventList } from "@/components/matches/event-list";
import { GoalDrawer } from "@/components/matches/goal-drawer";
import type { MatchGamesData } from "@/lib/queries/games";

type Props = { matchId: string; data: MatchGamesData; canScore: boolean; opponent: string | null };

/** 기록 탭: 쿼터별 득점 이벤트 목록 + "+ 득점" */
export function EventsTab({ matchId, data, canScore, opponent }: Props) {
  const { games } = data;
  const labelA = opponent ? "우리" : "A팀";
  const labelB = opponent ? opponent : "B팀";
  const total = games.reduce((n, g) => n + g.events.length, 0);
  return (
    <div className="flex flex-col gap-3">
      {canScore && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">총 {total}골</p>
          {games.length > 0 && (
            <GoalDrawer
              matchId={matchId}
              games={games}
              opponent={opponent}
              trigger={
                <Button size="sm">
                  <Plus /> 득점
                </Button>
              }
            />
          )}
        </div>
      )}
      {games.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">쿼터가 없어서 득점을 기록할 수 없습니다. 쿼터 탭에서 먼저 만드세요.</p>
      ) : (
        games.map(({ game, events }) => (
          <section key={game.id} className="bg-card rounded-xl border px-4 py-2 shadow-sm">
            <h3 className="flex items-center justify-between py-1 text-sm font-semibold">
              <span>Q{game.game_number}</span>
              <span className="tabular-nums">
                <span className="text-team-a">{game.team_a_score}</span> : <span className="text-team-b">{game.team_b_score}</span>
              </span>
            </h3>
            <EventList matchId={matchId} gameId={game.id} events={events} canScore={canScore} labelA={labelA} labelB={labelB} />
          </section>
        ))
      )}
    </div>
  );
}
