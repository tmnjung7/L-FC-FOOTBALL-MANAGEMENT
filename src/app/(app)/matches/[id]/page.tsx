import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceEditor } from "@/components/matches/attendance-editor";
import { AttendanceView } from "@/components/matches/attendance-view";
import { EventsTab } from "@/components/matches/events-tab";
import { GamesTab } from "@/components/matches/games-tab";
import { MatchActions } from "@/components/matches/match-actions";
import { MatchTabs, type MatchTab } from "@/components/matches/match-tabs";
import { RecordCta } from "@/components/matches/record-cta";
import { getViewer } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/date";
import { getTeamSettings } from "@/lib/queries/home";
import { getMatchGames } from "@/lib/queries/games";
import { getMatchDetail, getRecentVenues } from "@/lib/queries/matches";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await getMatchDetail(id);
  return { title: d ? `${formatDate(d.match.match_date)} 모임` : "모임" };
}

const STATUS_LABEL = { scheduled: "예정", done: "완료", cancelled: "취소" } as const;
const STATUS_VARIANT = { scheduled: "default", done: "muted", cancelled: "destructive" } as const;

export default async function MatchDetailPage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const active: MatchTab = tab === "games" || tab === "events" ? tab : "attendance";

  const [viewer, detail, settings, venues] = await Promise.all([getViewer(), getMatchDetail(id), getTeamSettings(), getRecentVenues()]);
  if (!detail) notFound();
  const { match, players, attendance } = detail;

  const gamesData = await getMatchGames(id);
  const gameCount = gamesData.games.length;
  const goalCount = gamesData.games.reduce((n, g) => n + g.events.length, 0);

  return (
    <>
      <PageHeader
        title={formatDate(match.match_date)}
        description={`${match.start_time ? formatTime(match.start_time) + " · " : ""}${match.venue ?? "장소 미정"}`}
        action={
          <div className="flex items-center gap-1">
            {viewer.canScore && <MatchActions match={match} gameCount={gameCount} recentVenues={venues} />}
            <Button asChild variant="ghost" size="icon" aria-label="모임 목록으로">
              <Link href="/matches"><ArrowLeft className="size-5" /></Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={STATUS_VARIANT[match.status]}>{STATUS_LABEL[match.status]}</Badge>
          <Badge variant="outline">{match.format}</Badge>
          {match.start_time && <span className="text-muted-foreground flex items-center gap-1 text-xs"><Clock className="size-3" />{formatTime(match.start_time)}</span>}
          {match.venue && <span className="text-muted-foreground flex items-center gap-1 text-xs"><MapPin className="size-3" />{match.venue}</span>}
        </div>
        {match.notes && <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm whitespace-pre-wrap">{match.notes}</p>}

        <RecordCta matchId={id} games={gamesData.games} canScore={viewer.canScore} attendeeCount={gamesData.attendees.length} status={match.status} />

        <MatchTabs matchId={id} active={active} counts={{ attendance: match.status === "scheduled" && !attendance.some((a) => a.status) ? attendance.filter((a) => a.rsvp === "yes").length : attendance.filter((a) => a.status === "present" || a.status === "late").length, games: gameCount, events: goalCount }} />

        {active === "attendance" &&
          (viewer.canScore ? (
            <AttendanceEditor matchId={id} players={players} attendance={attendance} lateThreshold={settings?.late_threshold_min ?? 10} isUpcoming={match.status === "scheduled"} />
          ) : (
            <AttendanceView match={match} players={players} attendance={attendance} myPlayerId={viewer.player?.id ?? null} />
          ))}
        {active === "games" && <GamesTab matchId={id} data={gamesData} canScore={viewer.canScore} />}
        {active === "events" && <EventsTab matchId={id} data={gamesData} canScore={viewer.canScore} />}
      </div>
    </>
  );
}
