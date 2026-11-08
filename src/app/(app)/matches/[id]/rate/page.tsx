import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PickNameCard } from "@/components/home/pick-name-card";
import { RatingForm } from "@/components/matches/rating-form";
import { getViewer } from "@/lib/auth";
import { daysBetween, formatDate, todayISO } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select("match_date").eq("id", id).maybeSingle();
  return { title: data ? `${formatDate(data.match_date)} 평점·피드백` : "평점" };
}

/** 경기 후 평점·피드백·MVP 입력 (팀원 누구나, 로그인 불필요) */
export default async function RatePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [viewer, { data: match }, { data: settings }] = await Promise.all([
    getViewer(),
    supabase.from("matches").select("*").eq("id", id).maybeSingle(),
    supabase.from("team_settings").select("rating_enabled, rating_deadline_hours").eq("id", 1).maybeSingle(),
  ]);
  if (!match) notFound();
  const me = viewer.player;

  const [{ data: att }, { data: players }, { data: myRatings }, { data: myFeedback }, { data: submitted }] = await Promise.all([
    supabase.from("attendance").select("player_id, status").eq("match_id", id).in("status", ["present", "late"]),
    supabase.from("players").select("id, name"),
    me ? supabase.from("ratings").select("player_id, score").eq("match_id", id).eq("rater_id", me.id) : Promise.resolve({ data: [] as { player_id: string; score: number }[] }),
    me ? supabase.from("match_feedback").select("comment, mvp_vote_id").eq("match_id", id).eq("player_id", me.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("match_feedback").select("player_id").eq("match_id", id),
  ]);
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.name]));
  const attendeeIds = (att ?? []).map((a) => a.player_id);
  const targets = attendeeIds.filter((pid) => pid !== me?.id).map((pid) => ({ id: pid, name: nameOf.get(pid) ?? "?" })).sort((a, b) => a.name.localeCompare(b.name));
  const iAttended = !!me && attendeeIds.includes(me.id);
  const hoursLeft = (settings?.rating_deadline_hours ?? 48) - daysBetween(match.match_date, todayISO()) * 24;
  const closed = match.status !== "done" || (hoursLeft <= -24 && !viewer.canScore);

  return (
    <>
      <PageHeader
        title="평점 · 피드백"
        description={`${formatDate(match.match_date)}${match.opponent ? ` · vs ${match.opponent}` : ""}`}
        action={<Button asChild variant="ghost" size="icon" aria-label="모임으로"><Link href={`/matches/${id}?tab=report`}><ArrowLeft className="size-5" /></Link></Button>}
      />
      <div className="flex flex-col gap-4 py-4">
        {!me ? (
          <PickNameCard />
        ) : (
          <>
            <Card>
              <CardContent className="text-sm">
                <p><b>{me.name}</b>님으로 입력합니다. {iAttended ? "" : <span className="text-amber-600">(이 모임 참석자 명단에 없습니다. 그래도 입력은 됩니다)</span>}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  참석 {attendeeIds.length}명 중 {submitted?.length ?? 0}명이 피드백을 남겼습니다.
                  {match.status !== "done" ? " · 모임이 아직 '완료' 상태가 아닙니다." : hoursLeft > 0 ? ` · 마감까지 약 ${hoursLeft}시간` : " · 입력 기한이 지났습니다 (수정은 대표에게 문의)"}
                </p>
              </CardContent>
            </Card>
            {targets.length === 0 ? (
              <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">출석 체크된 참석자가 없습니다. 대표가 출석 탭에서 당일 출석을 저장하면 평가 대상이 나타납니다.</p>
            ) : (
              <RatingForm
                matchId={id}
                targets={targets}
                initialRatings={Object.fromEntries((myRatings ?? []).map((r) => [r.player_id, Number(r.score)]))}
                initialComment={myFeedback?.comment ?? ""}
                initialMvp={myFeedback?.mvp_vote_id ?? null}
                ratingEnabled={settings?.rating_enabled !== false}
                readOnly={closed}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
