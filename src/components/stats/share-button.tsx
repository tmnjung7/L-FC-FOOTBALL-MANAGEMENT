"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** 화면의 한 영역(id)을 PNG 로 만들어 공유 시트(카톡) 또는 다운로드 */
export function ShareImageButton({ targetId, fileName, label = "이미지로 공유" }: { targetId: string; fileName: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    const el = document.getElementById(targetId);
    if (!el) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor || "#fff", cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: fileName }); } catch { /* 사용자가 취소 */ }
      } else {
        const a = document.createElement("a");
        a.href = dataUrl; a.download = `${fileName}.png`; a.click();
        toast.success("이미지를 저장했습니다");
      }
    } catch (e) {
      toast.error(`이미지 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={share} disabled={busy}>
      <Share2 /> {busy ? "만드는 중…" : label}
    </Button>
  );
}
