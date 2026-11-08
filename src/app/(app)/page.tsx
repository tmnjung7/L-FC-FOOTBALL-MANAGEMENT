import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NextMatchCard } from "@/components/home/next-match-card";
import { RecentResults } from "@/components/home/recent-results";
import { MonthLeaders } from "@/components/home/month-leaders";
import { RatingReminder } from "@/components/home/rating-reminder";
import { SetupNotice } from "@/components/home/setup-notice";
import { PickNameCard } from "@/components/home/pick-name-card";
import { NoRoleNotice } from "@/components/auth/no-role-notice";
import { DbUpdateNotice } from "@/components/auth/db-update-notice";
import { getMissingMigrations } from "@/lib/supabase/migrations-check";
import Link from "next/link";
import { KeyRound, Settings } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getMonthLeaders, getNextMatch, getPendingRatings, getRecentResults, getTeamSettings } from "@/lib/queries/home";

// 로그인 쿠키에 따라 내용이 달라지므로 항상 서버에서 렌더링
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="홈" />
        <div className="mt-4">
          <SetupNotice />
        </div>
      </>
    );
  }

  const [viewer, settings, recent, leaders, missing] = await Promise.all([getViewer(), getTeamSettings(), getRecentResults(3), getMonthLeaders(), getMissingMigrations()]);
  const [next, pending] = await Promise.all([
    getNextMatch(viewer.player?.id ?? null),
    getPendingRatings(viewer.player?.id ?? null, settings),
  ]);


  return (
    <>
      <PageHeader
        title={settings?.team_name ?? "홈"}
        action={
          <div className="flex items-center gap-1">
            <Link
              href="/whoami"
              className="bg-muted text-foreground flex h-9 max-w-32 items-center truncate rounded-full px-3 text-sm font-medium"
              title="내 이름 변경"
            >
              {viewer.player ? viewer.player.name : "이름 선택"}
              {viewer.user && (
                <span className={viewer.role ? "text-primary ml-1 text-xs" : "text-destructive ml-1 text-xs"}>
                  {viewer.role === "admin" ? "관리자" : viewer.role === "scorer" ? "기록원" : "권한 없음"}
                </span>
              )}
            </Link>
            {viewer.isAdmin && (
              <Link href="/settings" aria-label="설정" className="hover:bg-accent flex size-11 items-center justify-center rounded-md">
                <Settings className="text-muted-foreground size-5" />
              </Link>
            )}
            {viewer.user ? (
              <SignOutButton />
            ) : (
              <Link href="/login" aria-label="대표 로그인" className="hover:bg-accent flex size-11 items-center justify-center rounded-md">
                <KeyRound className="text-muted-foreground size-5" />
              </Link>
            )}
          </div>
        }
      />
      <div className="flex flex-col gap-4 py-4">
        {viewer.user && <DbUpdateNotice missing={missing} />}
        {viewer.user && !viewer.role && <NoRoleNotice email={viewer.user.email ?? ""} />}
        {!viewer.player && <PickNameCard />}
        <RatingReminder pending={pending} />
        <NextMatchCard next={next} hasPlayer={!!viewer.player} />
        <RecentResults results={recent} />
        <MonthLeaders data={leaders} />
      </div>
    </>
  );
}
