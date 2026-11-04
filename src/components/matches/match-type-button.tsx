"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { setMatchOpponent } from "@/app/actions/matches";

type Props = { matchId: string; opponent: string | null; trigger: ReactNode; recentOpponents?: string[] };

/** 자체전 ↔ 상대팀 경기 전환 바텀시트 (편성 화면·모임 화면에서 바로) */
export function MatchTypeButton({ matchId, opponent, trigger, recentOpponents = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(opponent ?? "");
  const [pending, startTransition] = useTransition();

  function apply(value: string | null) {
    startTransition(async () => {
      const r = await setMatchOpponent(matchId, value);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(value ? `상대팀 경기 (vs ${value})` : "자체전 (A팀 vs B팀)");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(opponent ?? ""); }}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>경기 유형</DrawerTitle>
          <DrawerDescription>상대팀 경기면 B팀 자리가 상대팀 이름으로 바뀌고, 우리 출전 선수만 편성합니다.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="opp-name">상대팀 이름</Label>
            <Input id="opp-name" list="opp-list" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: FC 강남 (비우면 '상대팀')" maxLength={40} autoFocus />
            <datalist id="opp-list">{recentOpponents.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <Button size="lg" disabled={pending} onClick={() => apply(name.trim() || "상대팀")}>
            {pending ? "저장 중…" : "상대팀 경기로 설정"}
          </Button>
          {opponent && (
            <Button size="lg" variant="outline" disabled={pending} onClick={() => apply(null)}>자체전(A팀 vs B팀)으로 되돌리기</Button>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild><Button variant="ghost" disabled={pending}>취소</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
