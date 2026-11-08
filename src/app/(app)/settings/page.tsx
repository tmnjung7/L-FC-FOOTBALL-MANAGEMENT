import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { DbUpdateNotice } from "@/components/auth/db-update-notice";
import { getViewer } from "@/lib/auth";
import { getTeamSettings } from "@/lib/queries/home";
import { getMissingMigrations } from "@/lib/supabase/migrations-check";

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

/** 팀 설정 (admin 전용) */
export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect("/");
  const [settings, missing] = await Promise.all([getTeamSettings(), getMissingMigrations()]);

  return (
    <>
      <PageHeader title="설정" description="관리자 전용" action={<Button asChild variant="ghost" size="icon" aria-label="홈으로"><Link href="/"><ArrowLeft className="size-5" /></Link></Button>} />
      <div className="flex flex-col gap-4 py-4">
        <DbUpdateNotice missing={missing} />
        {settings ? <SettingsForm s={settings} /> : <p className="text-muted-foreground text-sm">설정을 불러오지 못했습니다.</p>}
        <Card>
          <CardContent className="text-muted-foreground text-xs leading-relaxed">
            <p className="text-foreground mb-1 font-semibold">계정 안내</p>
            <p>lfc1·lfc2 = 관리자(전부), lfc3 = 기록원(경기 기록만). 비밀번호 변경은 Supabase → Authentication → Users 에서.</p>
            <p className="mt-1">AI 보고서: Vercel 환경변수 <code>ANTHROPIC_API_KEY</code> {process.env.ANTHROPIC_API_KEY ? "설정됨 ✔" : "미설정"}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
