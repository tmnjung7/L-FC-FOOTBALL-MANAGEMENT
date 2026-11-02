import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewGameButton } from "@/components/matches/new-game-button";
import { QuarterCountBar } from "@/components/matches/quarter-count-bar";
import type { MatchGamesData } from "@/lib/queries/games";

type Props = { matchId: string; data: MatchGamesData; canScore: boolean };

/** 쿼터 탭: 출전 수 미니 바 + 쿼터 카드 목록 */
export function GamesTab({ matchId, data, canScore }: Props) {
  const { games, attendees, quartersByPlayer } = data;
  return (
    <div className="flex flex-col gap-3">
      {canScore && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {attendees.length === 0 ? "먼저 출석 탭에서 참석자를 체크하세요." : `참석 ${attendees.length}명 · ${games.length}쿼터`}
          </p>
          <NewGameButton matchId={matchId} hasPrevious={games.length > 0} />
        </div>
      )}
      <QuarterCountBar attendees={attendees} quartersByPlayer={quartersByPlayer} totalGames={games.length} />
      {games.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">아직 쿼터가 없습니다.{canScore ? " '쿼터 추가'로 시작하세요." : ""}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map(({ game, lineup, tactic_name }) => {
            const a = lineup.filter((l) => l.team === "A");
            const b = lineup.filter((l) => l.team === "B");
            return (
              <li key={game.id}>
                <Link href={`/matches/${matchId}/games/${game.id}`} className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Q{game.game_number}</p>
                    <p className="text-2xl font-bold tabular-nums">
                      <span className="text-team-a">{game.team_a_score}</span>
                      <span className="text-muted-foreground mx-1">:</span>
                      <span className="text-team-b">{game.team_b_score}</span>
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate"><Badge variant="teamA" className="mr-1 h-4 px-1 text-[10px]">A</Badge>{a.map((l) => l.name).join(", ") || "미편성"}</p>
                    <p className="mt-1 truncate"><Badge variant="teamB" className="mr-1 h-4 px-1 text-[10px]">B</Badge>{b.map((l) => l.name).join(", ") || "미편성"}</p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{game.duration_min}분 · {lineup.length}명</span>
                      {tactic_name && <span className="flex items-center gap-0.5"><ClipboardList className="size-3" />{tactic_name}</span>}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
