"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { addGoal } from "@/app/actions/events";
import type { LineupEntry } from "@/lib/queries/games";

type Props = { matchId: string; gameId: string; opponent: string; lineup: LineupEntry[]; getMinute: () => number | null; trigger: ReactNode };

/** 상대팀 경기의 실점 입력: "실점 기록" 한 번. 우리 선수 자책골이면 이름 선택 */
export function ConcedeDrawer({ matchId, gameId, opponent, lineup, getMinute, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ownGoalMode, setOwnGoalMode] = useState(false);
  const ours = lineup.filter((l) => l.team === "A");

  function save(ownScorerId: string | null) {
    startTransition(async () => {
      const r = await addGoal(matchId, gameId, { team: "B", scorer_id: ownScorerId, assist_id: null, minute: getMinute(), is_own_goal: !!ownScorerId });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(ownScorerId ? `실점 (자책골 · ${ours.find((o) => o.player_id === ownScorerId)?.name ?? ""})` : `${opponent} 득점 · 실점`);
      setOpen(false);
      setOwnGoalMode(false);
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (v) setOwnGoalMode(false); }}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{opponent} 득점 (실점)</DrawerTitle>
          <DrawerDescription>{ownGoalMode ? "자책골 넣은 우리 선수를 고르세요" : "실점을 기록합니다. 득점자는 기록하지 않습니다."}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-2">
          {ownGoalMode ? (
            <div className="grid grid-cols-2 gap-2">
              {ours.map((p) => (
                <button key={p.player_id} type="button" disabled={pending} onClick={() => save(p.player_id)} className="bg-team-a h-14 rounded-xl text-base font-bold text-white shadow-sm active:scale-[0.97]">
                  {p.name}
                </button>
              ))}
              {ours.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">출전 선수가 없습니다.</p>}
            </div>
          ) : (
            <Button size="lg" className="bg-team-b hover:bg-team-b/90 h-16 text-xl" disabled={pending} onClick={() => save(null)}>
              {pending ? "저장 중…" : "실점 기록"}
            </Button>
          )}
          <button type="button" onClick={() => setOwnGoalMode((v) => !v)} className="text-muted-foreground self-center text-xs underline-offset-4 hover:underline">
            {ownGoalMode ? "← 일반 실점으로" : "우리 선수 자책골인가요?"}
          </button>
        </div>
        <DrawerFooter>
          <DrawerClose asChild><Button variant="ghost" disabled={pending}>취소</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
