import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SetupNotice } from "@/components/home/setup-notice";
import { MatchCard } from "@/components/matches/match-card";
import { MatchFormDrawer } from "@/components/matches/match-form-drawer";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getTeamSettings } from "@/lib/queries/home";
import { getMatchList, getRecentVenues } from "@/lib/queries/matches";

export const metadata: Metadata = { title: "경기" };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="경기" />
        <div className="mt-4"><SetupNotice /></div>
      </>
    );
  }

  const [viewer, { upcoming, past }, settings, venues] = await Promise.all([getViewer(), getMatchList(), getTeamSettings(), getRecentVenues()]);

  return (
    <>
      <PageHeader
        title="경기"
        description={`예정 ${upcoming.length} · 지난 ${past.length}`}
        action={
          viewer.canScore ? (
            <MatchFormDrawer
              defaultFormat={settings?.default_format ?? "6v6"}
              recentVenues={venues}
              trigger={
                <Button size="sm">
                  <CalendarPlus /> 일정 등록
                </Button>
              }
            />
          ) : undefined
        }
      />
      <div className="flex flex-col gap-6 py-4">
        <section>
          <h2 className="text-muted-foreground mb-2 px-1 text-xs font-semibold">예정된 모임</h2>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">
              예정된 모임이 없습니다.{viewer.canScore ? " 오른쪽 위 '일정 등록'으로 한 달치를 한 번에 넣을 수 있습니다." : ""}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((m) => (
                <MatchCard key={m.match_id} m={m} />
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-muted-foreground mb-2 px-1 text-xs font-semibold">지난 모임</h2>
          {past.length === 0 ? (
            <p className="text-muted-foreground bg-card rounded-xl border px-4 py-6 text-center text-sm">아직 끝난 모임이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {past.map((m) => (
                <MatchCard key={m.match_id} m={m} />
              ))}
            </ul>
          )}
        </section>
        {!viewer.user && <p className="text-muted-foreground text-center text-xs">일정 등록·기록 입력은 대표 계정 로그인 후 가능합니다.</p>}
      </div>
    </>
  );
}
