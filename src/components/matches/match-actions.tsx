"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MoreHorizontal, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { MatchFormDrawer } from "@/components/matches/match-form-drawer";
import { deleteMatch, setMatchStatus } from "@/app/actions/matches";
import type { MatchRow } from "@/types/database";

type Props = { match: MatchRow; gameCount: number; recentVenues: string[]; recentOpponents?: string[] };

/** 모임 상세 헤더의 대표용 메뉴: 수정 / 모임 종료(완료) / 취소 / 예정으로 되돌리기 / 삭제 */
export function MatchActions({ match, gameCount, recentVenues, recentOpponents = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(status: MatchRow["status"], label: string) {
    startTransition(async () => {
      const r = await setMatchStatus(match.id, status);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(label);
        router.refresh();
      }
    });
  }

  function remove() {
    const msg = gameCount > 0
      ? `이 모임을 삭제할까요?\n쿼터 ${gameCount}개와 득점·출석·평점 기록이 모두 지워지며 되돌릴 수 없습니다.\n(기록은 남기고 싶다면 '모임 취소'를 쓰세요)`
      : "이 모임 일정을 삭제할까요? 되돌릴 수 없습니다.";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await deleteMatch(match.id);
      if (r && "error" in r) toast.error(r.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <MatchFormDrawer
        match={match}
        recentVenues={recentVenues}
        recentOpponents={recentOpponents}
        trigger={
          <Button variant="outline" size="icon" aria-label="모임 수정">
            <Pencil className="size-5" />
          </Button>
        }
      />
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" size="icon" aria-label="더 보기">
            <MoreHorizontal className="size-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>모임 상태</DrawerTitle>
            <DrawerDescription>
              현재: {match.status === "scheduled" ? "예정" : match.status === "done" ? "완료" : "취소"} · 쿼터 {gameCount}개
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4">
            {match.status !== "done" && (
              <DrawerClose asChild>
                <Button size="lg" disabled={pending} onClick={() => change("done", "모임을 완료 처리했습니다. 이제 통계에 반영됩니다.")}>
                  <CheckCircle2 /> 모임 종료 (완료 처리)
                </Button>
              </DrawerClose>
            )}
            {match.status !== "scheduled" && (
              <DrawerClose asChild>
                <Button size="lg" variant="outline" disabled={pending} onClick={() => change("scheduled", "예정 상태로 되돌렸습니다.")}>
                  <RotateCcw /> 예정으로 되돌리기
                </Button>
              </DrawerClose>
            )}
            {match.status !== "cancelled" && (
              <DrawerClose asChild>
                <Button size="lg" variant="outline" disabled={pending} onClick={() => change("cancelled", "모임을 취소했습니다.")}>
                  <XCircle /> 모임 취소 (우천 등)
                </Button>
              </DrawerClose>
            )}
            <DrawerClose asChild>
              <Button size="lg" variant={gameCount === 0 ? "destructive" : "outline"} className={gameCount > 0 ? "text-destructive" : undefined} disabled={pending} onClick={remove}>
                <Trash2 /> {gameCount === 0 ? "일정 삭제" : `모임 삭제 (쿼터 ${gameCount}개 포함)`}
              </Button>
            </DrawerClose>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost">닫기</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
