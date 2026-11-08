"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMatch } from "@/app/actions/matches";

/** 경기 목록 카드 옆 작은 삭제 버튼 (scorer 이상). 예정 일정 정리용 */
export function MatchDeleteButton({ matchId, label, gameCount }: { matchId: string; label: string; gameCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const msg = gameCount > 0 ? `${label} 모임을 삭제할까요?\n쿼터 ${gameCount}개와 기록이 모두 지워집니다.` : `${label} 일정을 삭제할까요?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await deleteMatch(matchId, { redirectTo: null });
      if ("error" in r) toast.error(r.error);
      else { toast.success("삭제했습니다"); router.refresh(); }
    });
  }
  return (
    <button type="button" onClick={remove} disabled={pending} aria-label="일정 삭제" className="text-muted-foreground hover:text-destructive hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-md">
      <Trash2 className="size-4" />
    </button>
  );
}
