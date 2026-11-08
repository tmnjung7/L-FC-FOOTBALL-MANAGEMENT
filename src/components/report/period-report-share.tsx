"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Image as ImageIcon, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { savePeriodReport } from "@/app/actions/reports";
import { periodReportToText, type PeriodReportData } from "@/lib/report/period-text";

type Props = { d: PeriodReportData; isAdmin: boolean; periodKey: string; from?: string; to?: string };

export function PeriodReportShare({ d, isAdmin, periodKey, from, to }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const link = typeof window !== "undefined" ? window.location.href : "";

  async function copyText() {
    const text = periodReportToText(d, link);
    try { await navigator.clipboard.writeText(text); toast.success("결산 텍스트를 복사했습니다"); }
    catch { if (typeof navigator.share === "function") await navigator.share({ text }); else toast.error("복사가 막혔습니다"); }
  }
  async function shareImage() {
    const el = document.getElementById("period-report-image");
    if (!el) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 1, cacheBust: true, backgroundColor: "#ffffff" });
      const blob = await (await fetch(dataUrl)).blob();
      const name = `${d.teamName}_${d.period.label}_결산.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); } catch {} }
      else { const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click(); toast.success("이미지를 저장했습니다"); }
    } catch (e) { toast.error(`이미지 생성 실패: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }
  function save(withAi: boolean) {
    startTransition(async () => {
      const r = await savePeriodReport(periodKey, from, to, { withAi });
      if ("error" in r) toast.error(r.error, { duration: 10000 });
      else { toast.success(withAi ? "AI 가 결산을 다듬어 저장했습니다" : "결산을 저장했습니다"); router.refresh(); }
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={copyText} className="h-14 flex-col gap-0.5 text-xs"><Copy className="size-5" /> 텍스트 복사</Button>
        <Button size="lg" variant="outline" onClick={shareImage} disabled={busy} className="h-14 flex-col gap-0.5 text-xs"><ImageIcon className="size-5" /> {busy ? "만드는 중…" : "이미지 공유"}</Button>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{d.savedAt ? `저장됨: ${d.savedAt.slice(0, 16).replace("T", " ")}` : "아직 저장 안 함 (화면은 항상 최신 집계)"}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={pending || d.period.key === "all"}><Save /> 저장</Button>
            {d.aiConfigured && <Button size="sm" onClick={() => save(true)} disabled={pending || d.period.key === "all"}><Sparkles /> {pending ? "작성 중…" : "AI로 다듬어 저장"}</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
