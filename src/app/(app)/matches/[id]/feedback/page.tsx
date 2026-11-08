import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AdminFeedbackForm, type FeedbackTarget } from "@/components/report/admin-feedback-form";
import { getAdminInput } from "@/app/actions/admin-feedback";
import { getViewer } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { getMatchGames } from "@/lib/queries/games";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select("match_date").eq("id", id).maybeSingle();
  return { title: data ? `${formatDate(data.match_date)} 피드백 작성` : "피드백" };
}

/** 관리자(lfc1·lfc2) 전용: 참석자별 키워드·메모 + MVP + 총평 */
export default async function AdminFeedbackPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect(`/matches/${id}?tab=report`);

  const supabase = await createClient();
  const [{ data: match }, { data: attendance }, { data: players }, games, adminInput] = await Promise.all([
    supabase.from("matches").select("*").eq("id", id).maybeSingle(),
    supabase.from("attendance").select("player_id, status, note, late_minutes").eq("match_id", id).in("status", ["present", "late"]),
    supabase.from("players").select("id, name"),
    getMatchGames(id),
    getAdminInput(id),
  ]);
  if (!match) notFound();
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.name]));

  const goals = new Map<string, number>(), assists = new Map<string, number>(), quarters = new Map<string, number>(), gk = new Map<string, number>();
  for (const g of games.games) {
    for (const l of g.lineup) {
      quarters.set(l.player_id, (quarters.get(l.player_id) ?? 0) + 1);
      if (l.position === "GK") gk.set(l.player_id, (gk.get(l.player_id) ?? 0) + 1);
    }
    for (const e of g.events) {
      if (e.scorer_id && !e.is_own_goal) goals.set(e.scorer_id, (goals.get(e.scorer_id) ?? 0) + 1);
      if (e.assist_id) assists.set(e.assist_id, (assists.get(e.assist_id) ?? 0) + 1);
    }
  }
  const targets: FeedbackTarget[] = (attendance ?? [])
    .map((a) => ({ id: a.player_id, name: nameOf.get(a.player_id) ?? "?", note: a.note ?? "", goals: goals.get(a.player_id) ?? 0, assists: assists.get(a.player_id) ?? 0, quarters: quarters.get(a.player_id) ?? 0, gk: gk.get(a.player_id) ?? 0, late: a.status === "late" }))
    .sort((a, b) => b.quarters - a.quarters || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="경기 피드백 작성"
        description={`${formatDate(match.match_date)}${match.opponent ? ` · vs ${match.opponent}` : ""} · 관리자 전용`}
        action={<Button asChild variant="ghost" size="icon" aria-label="보고서로"><Link href={`/matches/${id}?tab=report`}><ArrowLeft className="size-5" /></Link></Button>}
      />
      <div className="py-4">
        {targets.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">출석 체크된 참석자가 없습니다. 출석 탭에서 당일 출석을 먼저 저장해 주세요.</p>
        ) : (
          <AdminFeedbackForm matchId={id} targets={targets} initialMvp={adminInput?.mvp_player_id ?? null} initialMemo={adminInput?.memo ?? ""} />
        )}
      </div>
    </>
  );
}
