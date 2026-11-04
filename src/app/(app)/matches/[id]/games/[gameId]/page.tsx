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
  const lineupEmpty = current.lineup.length === 0;
  const external = !!match.opponent;
  const labelA = external ? "우리" : "A팀";
  const labelB = external ? match.opponent! : "B팀";

  const lineupSection = (
    <section className={lineupEmpty && viewer.canScore ? "ring-primary/40 rounded-xl ring-2 ring-offset-2" : undefined}>
      <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs">1</span>
        {external ? "출전 선수" : "편성"} {current.lineup.length}명
        {lineupEmpty && viewer.canScore && <span className="text-primary text-xs font-normal">{external ? "← 먼저 출전할 선수를 고르세요" : "← 먼저 여기서 A팀/B팀을 정하세요"}</span>}
      </h3>
      {viewer.canScore ? (
        <LineupEditor
          matchId={matchId}
          gameId={gameId}
          attendees={data.attendees}
          lineup={current.lineup}
          perTeam={perTeam}
          hasPrevious={!!prev}
          quartersByPlayer={data.quartersByPlayer}
          external={external}
        />
      ) : (
        <div className={external ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
          {(external ? (["A"] as const) : (["A", "B"] as const)).map((team) => (
            <div key={team} className="bg-card rounded-xl border p-2">
              <Badge variant={team === "A" ? "teamA" : "teamB"} className="mb-1">{team === "A" ? labelA : labelB}</Badge>
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
  );

  const scoreSection = (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs">2</span>
        타이머 시작 → 골 버튼
      </h3>
      <Scoreboard matchId={matchId} current={current} canScore={viewer.canScore} opponent={match.opponent} />
      {viewer.canScore && isLast && (
        <NewGameButton matchId={matchId} hasPrevious size="lg" label={`다음 쿼터 (Q${current.game.game_number + 1}) 시작 — 편성 그대로 복사`} />
      )}
      <section className="bg-card rounded-xl border px-4 py-2 shadow-sm">
        <h3 className="flex items-center gap-2 py-1 text-sm font-semibold">
          <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full text-xs">3</span>
          이 쿼터 득점 {current.events.length}
        </h3>
        <EventList matchId={matchId} gameId={gameId} events={current.events} canScore={viewer.canScore} labelA={labelA} labelB={labelB} />
      </section>
    </div>
  );

  return (
    <>
      <PageHeader
        title={`Q${current.game.game_number}`}
        description={`${formatDateShort(match.match_date)}${match.opponent ? ` · vs ${match.opponent}` : ""} · ${match.venue ?? ""}`}
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
      <div className="flex flex-col gap-5 py-3 md:grid md:grid-cols-2 md:items-start">
        {lineupEmpty && viewer.canScore ? (
          <>
            <div className="flex flex-col gap-4">{lineupSection}</div>
            {scoreSection}
          </>
        ) : (
          <>
            {scoreSection}
            <div className="flex flex-col gap-4">{lineupSection}</div>
          </>
        )}
        {viewer.canScore && <div className="md:col-span-2"><GameSettings matchId={matchId} game={current.game} tactics={data.tactics} /></div>}
      </div>
    </>
  );
}
