"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Image as ImageIcon, Link2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveMatchReport } from "@/app/actions/reports";
import type { ReportData } from "@/lib/report/build";
import { reportToText } from "@/lib/report/text";

type Props = { d: ReportData; isAdmin: boolean; savedAt: string | null };

/** 보고서 공유: 텍스트 복사(카톡) · 이미지(세로 한 장) · 링크 · 확정 저장(admin) */
export function ReportShare({ d, isAdmin, savedAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const link = typeof window !== "undefined" ? `${window.location.origin}/matches/${d.matchId}?tab=report` : "";

  async function copyText() {
    const text = reportToText(d, link);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("보고서 텍스트를 복사했습니다. 카톡에 붙여넣으세요.");
    } catch {
      // iOS 일부에서 클립보드 막힘 → 공유 시트로 대체
      if (typeof navigator.share === "function") await navigator.share({ text });
      else toast.error("복사가 막혔습니다. 길게 눌러 직접 복사해 주세요.");
    }
  }

  async function shareImage() {
    const el = document.getElementById("report-image-card");
    if (!el) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 1, cacheBust: true, backgroundColor: "#ffffff" });
      const blob = await (await fetch(dataUrl)).blob();
      const name = `${d.teamName}_${d.dateLabel.slice(0, 10)}_경기결과.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name, text: `${d.teamName} ${d.dateLabel} 경기 결과\n${link}` }); } catch { /* 취소 */ }
      } else {
        const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click();
        toast.success("이미지를 저장했습니다");
      }
    } catch (e) {
      toast.error(`이미지 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); toast.success("링크를 복사했습니다"); } catch { toast.error("복사 실패"); }
  }

  function save() {
    startTransition(async () => {
      const r = await saveMatchReport(d.matchId);
      if ("error" in r) toast.error(r.error);
      else { toast.success("보고서를 확정 저장했습니다"); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Button size="lg" onClick={copyText} className="h-14 flex-col gap-0.5 text-xs"><Copy className="size-5" /> 텍스트 복사</Button>
        <Button size="lg" variant="outline" onClick={shareImage} disabled={busy} className="h-14 flex-col gap-0.5 text-xs"><ImageIcon className="size-5" /> {busy ? "만드는 중…" : "이미지 공유"}</Button>
        <Button size="lg" variant="outline" onClick={copyLink} className="h-14 flex-col gap-0.5 text-xs"><Link2 className="size-5" /> 링크 복사</Button>
      </div>
      {isAdmin && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{savedAt ? `확정 저장: ${savedAt.slice(0, 16).replace("T", " ")}` : "아직 확정 저장 안 함 (화면은 항상 최신 자동 생성)"}</span>
          <Button variant="ghost" size="sm" onClick={save} disabled={pending}><Save /> {pending ? "저장 중…" : "보고서 확정 저장"}</Button>
        </div>
      )}
    </div>
  );
}
