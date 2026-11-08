"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { generateAiMatchReport } from "@/app/actions/reports";

type Props = { matchId: string; configured: boolean; hasAi: boolean; generatedAt: string | null };

/** "AI로 보고서 다듬기" (admin). 키워드·기록·총평을 Claude 가 자연스러운 글로 바꾼다 */
export function AiReportButton({ matchId, configured, hasAi, generatedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await generateAiMatchReport(matchId);
      if ("error" in r) { toast.error(r.error, { duration: 10000 }); return; }
      toast.success("AI 가 보고서를 다듬어 썼습니다");
      router.refresh();
    });
  }

  if (!configured) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground text-xs">
          <p className="text-foreground mb-1 flex items-center gap-1 text-sm font-semibold"><Sparkles className="size-4" /> AI 로 보고서 다듬기 (설정 필요)</p>
          Anthropic API 키를 Vercel 환경변수 <code>ANTHROPIC_API_KEY</code> 로 넣고 Redeploy 하면, 키워드·기록·총평을 바탕으로 자연스러운 보고서 글을 자동으로 써 줍니다. (경기당 약 10~20원)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-muted-foreground text-xs">
        {hasAi ? `AI 보고서 생성: ${generatedAt?.slice(0, 16).replace("T", " ")} · 피드백을 고쳤으면 다시 생성하세요` : "키워드·기록·총평을 바탕으로 AI 가 글을 다듬어 씁니다 (20초 정도)"}
      </p>
      <Button size="sm" onClick={run} disabled={pending} className="shrink-0">
        <Sparkles /> {pending ? "작성 중…" : hasAi ? "AI 다시 쓰기" : "AI로 다듬기"}
      </Button>
    </div>
  );
}
