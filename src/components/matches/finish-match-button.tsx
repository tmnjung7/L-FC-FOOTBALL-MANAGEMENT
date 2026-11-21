"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMatchStatus } from "@/app/actions/matches";

type Props = { matchId: string; gameCount: number; className?: string; variant?: "default" | "outline" | "secondary" };

/**
 * "경기 종료" — 모임을 완료(done) 처리하고 보고서 탭으로 이동.
 * 모임 화면 위쪽(기록 중 카드)과 마지막 쿼터 화면에서 바로 누를 수 있다. 되돌리기는 ⋯ 메뉴의 "예정으로 되돌리기".
 */
export function FinishMatchButton({ matchId, gameCount, className, variant = "outline" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      variant={variant}
      className={className ?? "h-14 text-base"}
      disabled={pending}
      onClick={() => {
        if (!confirm(`경기를 종료할까요?\n${gameCount}쿼터 기록으로 모임을 '완료' 처리하고 통계·보고서에 반영합니다.\n(⋯ 메뉴에서 '예정으로 되돌리기'로 되돌릴 수 있습니다)`)) return;
        startTransition(async () => {
          const r = await setMatchStatus(matchId, "done");
          if ("error" in r) toast.error(r.error);
          else {
            toast.success("경기를 종료했습니다. 보고서 탭에서 피드백을 입력해 보세요.");
            router.push(`/matches/${matchId}?tab=report`);
            router.refresh();
          }
        });
      }}
    >
      <Flag /> 경기 종료 (완료 처리)
    </Button>
  );
}
