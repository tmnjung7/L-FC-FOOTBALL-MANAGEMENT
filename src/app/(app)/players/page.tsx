import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PlayerList } from "@/components/players/player-list";
import { PlayerFormDrawer } from "@/components/players/player-form-drawer";
import { SetupNotice } from "@/components/home/setup-notice";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getPlayersWithStats } from "@/lib/queries/players";

export const metadata: Metadata = { title: "선수" };
export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="선수" />
        <div className="mt-4"><SetupNotice /></div>
      </>
    );
  }

  const [viewer, { players, stats }] = await Promise.all([getViewer(), getPlayersWithStats()]);

  return (
    <>
      <PageHeader
        title="선수"
        description={`${players.filter((p) => p.is_active).length}명 활동 중`}
        action={
          viewer.isAdmin ? (
            <PlayerFormDrawer
              trigger={
                <Button size="sm">
                  <Plus /> 선수 등록
                </Button>
              }
            />
          ) : undefined
        }
      />
      <div className="py-4">
        <PlayerList players={players} stats={stats} />
        {!viewer.isAdmin && (
          <p className="text-muted-foreground mt-4 text-center text-xs">선수 등록·수정은 관리자(lfc1, lfc2) 로그인 후 가능합니다.</p>
        )}
      </div>
    </>
  );
}
