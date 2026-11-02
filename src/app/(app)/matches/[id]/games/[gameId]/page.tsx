import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventList } from "@/components/matches/event-list";
import { GameSettings } from "@/components/matches/game-settings";
import { LineupEditor } from "@/components/matches/lineup-editor";
import { NewGameButton } from "@/components/matches/new-game-button";
import { Scoreboard } from "@/components/matches/scoreboard";
import { getViewer } from "@/lib/auth";
import { formatDateShort } from "@/lib/date";
import { getMatchGames } from "@/lib/queries/games";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; gameId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("games").select("game_number").eq("id", gameId).maybeSingle();
  return { title: data ? `Q${data.game_number}` : "쿼터" };
}

/** 쿼터 화면: 스코어보드·타이머·골 버튼 / 편성 / 득점 목록 / 설정 */
export default async function GamePage({ params }: Props) {
  const { id: matchId, gameId } = await params;
  const supabase = await createClient();
  const [viewer, { data: match }, data] = await Promise.all([
    getViewer(),
    supabase.from("matches").select("*").eq("id", matchId).maybeSingle(),
    getMatchGames(matchId),
  ]);
  if (!match) notFound();
  const idx = data.games.findIndex((g) => g.game.id === gameId);
  if (idx < 0) notFound();
  const current = data.games[idx];
  const prev = data.games[idx - 1];
  const next = data.games[idx + 1];
  const perTeam = match.format === "5v5" ? 5 : 6;
  const isLast = idx === data.games.length - 1;

  return (
    <>
      <PageHeader
        title={`Q${current.game.game_number}`}
        description={`${formatDateShort(match.match_date)} · ${match.venue ?? ""}`}
        action={
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="이전 쿼터" disabled={!prev}>
              {prev ? <Link href={`/matches/${matchId}/games/${prev.game.id}`}><ChevronLeft className="size-5" /></Link> : <span><ChevronLeft className="size-5 opacity-30" /></span>}
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="다음 쿼터">
              {next ? <Link href={`/matches/${matchId}/games/${next.game.id}`}><ChevronRight className="size-5" /></Link> : <span><ChevronRight className="size-5 opacity-30" /></span>}
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="모임으로">
              <Link href={`/matches/${matchId}?tab=games`}><ArrowLeft className="size-5" /></Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-4 py-3 md:grid md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-4">
          <Scoreboard matchId={matchId} current={current} games={data.games} canScore={viewer.canScore} />
          {viewer.canScore && isLast && (
            <NewGameButton matchId={matchId} hasPrevious size="lg" label={`다음 쿼터 (Q${current.game.game_number + 1}) 편성 복사해서 시작`} />
          )}
          <section className="bg-card rounded-xl border px-4 py-2 shadow-sm">
            <h3 className="py-1 text-sm font-semibold">이 쿼터 득점</h3>
            <EventList matchId={matchId} gameId={gameId} events={current.events} canScore={viewer.canScore} />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold">편성 {current.lineup.length}명</h3>
            {viewer.canScore ? (
              <LineupEditor
                matchId={matchId}
                gameId={gameId}
                attendees={data.attendees}
                lineup={current.lineup}
                perTeam={perTeam}
                hasPrevious={!!prev}
                quartersByPlayer={data.quartersByPlayer}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map((team) => (
                  <div key={team} className="bg-card rounded-xl border p-2">
                    <Badge variant={team === "A" ? "teamA" : "teamB"} className="mb-1">{team}팀</Badge>
                    <ul className="text-sm">
                      {current.lineup.filter((l) => l.team === team).map((l) => (
                        <li key={l.id} className="flex justify-between py-0.5">
                          <span>{l.name}</span>
                          <span className="text-muted-foreground text-xs">{l.position ?? ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
          {viewer.canScore && <GameSettings matchId={matchId} game={current.game} tactics={data.tactics} />}
        </div>
      </div>
    </>
  );
}
