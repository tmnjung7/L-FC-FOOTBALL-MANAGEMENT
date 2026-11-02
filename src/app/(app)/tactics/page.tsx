import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/home/setup-notice";
import { TacticsBoard } from "@/components/tactics/tactics-board";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getActivePlayers, getTactics } from "@/lib/queries/tactics";

export const metadata: Metadata = { title: "전술판" };
export const dynamic = "force-dynamic";

export default async function TacticsPage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="전술판" />
        <div className="mt-4"><SetupNotice /></div>
      </>
    );
  }
  const [viewer, players, tactics] = await Promise.all([getViewer(), getActivePlayers(), getTactics()]);
  return (
    <>
      <PageHeader title="전술판" description="자유롭게 놓고 움직이기 · 휴대폰에 자동 보관" />
      <div className="py-3">
        <TacticsBoard players={players} tactics={tactics} isAdmin={viewer.isAdmin} />
      </div>
    </>
  );
}
