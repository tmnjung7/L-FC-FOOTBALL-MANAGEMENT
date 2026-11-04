"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { addGoal } from "@/app/actions/events";
import type { LineupEntry } from "@/lib/queries/games";
import type { TeamSide } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = {
  matchId: string;
  gameId: string;
  team: TeamSide; // 득점이 올라가는 팀
  lineup: LineupEntry[];
  /** 타이머에서 읽은 현재 경과 분 (자동 입력) */
  getMinute: () => number | null;
  trigger: ReactNode;
};

/**
 * 경기 중 "골" 버튼용 초간단 입력.
 * 1) 누가 넣었나요? (그 팀 선수만, 큰 버튼)  2) 도움 준 사람? (건너뛰기 가능) → 저장. 분은 타이머에서 자동.
 */
export function QuickGoalDrawer({ matchId, gameId, team, lineup, getMinute, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"scorer" | "assist">("scorer");
  const [ownGoal, setOwnGoal] = useState(false);
  const [scorer, setScorer] = useState<LineupEntry | null>(null);

  const scorerTeam: TeamSide = ownGoal ? (team === "A" ? "B" : "A") : team;
  const scorerList = lineup.filter((l) => l.team === scorerTeam);
  const assistList = lineup.filter((l) => l.team === team && l.player_id !== scorer?.player_id);
  const teamClass = team === "A" ? "bg-team-a hover:bg-team-a/90" : "bg-team-b hover:bg-team-b/90";

  function reset() { setStep("scorer"); setOwnGoal(false); setScorer(null); }

  function save(assistId: string | null) {
    if (!scorer) return;
    startTransition(async () => {
      const r = await addGoal(matchId, gameId, { team, scorer_id: scorer.player_id, assist_id: ownGoal ? null : assistId, minute: getMinute(), is_own_goal: ownGoal });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(`${team}팀 골! ${scorer.name}${ownGoal ? " (자책)" : ""}${assistId ? ` · 도움 ${assistList.find((a) => a.player_id === assistId)?.name ?? ""}` : ""}`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (v) reset(); }}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        {step === "scorer" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{team}팀 골 · 누가 넣었나요?</DrawerTitle>
              <DrawerDescription>{ownGoal ? `${scorerTeam}팀 선수 중 자책골 넣은 사람을 고르세요` : "이름을 한 번 누르면 다음 단계로 넘어갑니다"}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-2">
              {scorerList.length === 0 ? (
                <p className="text-muted-foreground bg-muted rounded-md px-3 py-4 text-center text-sm">이 쿼터 {scorerTeam}팀 편성이 비어 있습니다. 먼저 아래 &lsquo;편성&rsquo;에서 선수를 배정해 주세요.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {scorerList.map((p) => (
                    <button
                      key={p.player_id}
                      type="button"
                      disabled={pending}
                      onClick={() => { setScorer(p); if (ownGoal) { setStep("assist"); } else setStep("assist"); }}
                      className={cn("h-14 rounded-xl text-base font-bold text-white shadow-sm active:scale-[0.97]", scorerTeam === "A" ? "bg-team-a" : "bg-team-b")}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {lineup.some((l) => l.team !== team) && (
                <button type="button" onClick={() => setOwnGoal((v) => !v)} className={cn("text-muted-foreground self-center text-xs underline-offset-4 hover:underline", ownGoal && "text-destructive font-semibold")}>
                  {ownGoal ? "자책골 취소 (우리 팀 득점으로)" : "상대 선수 자책골인가요?"}
                </button>
              )}
            </div>
            <DrawerFooter>
              <DrawerClose asChild><Button variant="ghost">취소</Button></DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>{scorer?.name} 골 · 도움 준 사람은?</DrawerTitle>
              <DrawerDescription>없으면 아래 &lsquo;도움 없음&rsquo;을 누르면 바로 저장됩니다.</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-2">
              {!ownGoal && (
                <div className="grid grid-cols-2 gap-2">
                  {assistList.map((p) => (
                    <button key={p.player_id} type="button" disabled={pending} onClick={() => save(p.player_id)} className="bg-card hover:bg-accent h-14 rounded-xl border text-base font-semibold active:scale-[0.97]">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              <Button size="lg" className={cn("h-14 text-base", teamClass)} disabled={pending} onClick={() => save(null)}>
                {pending ? "저장 중…" : ownGoal ? "자책골 저장" : "도움 없음 · 저장"}
              </Button>
            </div>
            <DrawerFooter>
              <Button variant="ghost" onClick={() => { setStep("scorer"); setScorer(null); }} disabled={pending}>← 득점자 다시 고르기</Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
