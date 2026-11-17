"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { addGuestToMatch } from "@/app/actions/guests";

/** "+ 용병" — 이름만 적으면 이 모임 참석자(출석)로 추가. 같은 이름이면 기존 용병 재사용 */
export function AddGuestButton({ matchId, size = "sm", recentGuests = [] }: { matchId: string; size?: "sm" | "lg"; recentGuests?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await addGuestToMatch(matchId, name);
      if ("error" in r) { toast.error(r.error, { duration: 8000 }); return; }
      toast.success(`용병 ${name.trim()} 을(를) 참석자에 추가했습니다`);
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" size={size}><UserPlus /> 용병</Button>
      </DrawerTrigger>
      <DrawerContent>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <DrawerHeader>
            <DrawerTitle>용병 추가</DrawerTitle>
            <DrawerDescription>이름만 적으면 이 모임 참석자로 들어가고 편성·득점에 쓸 수 있습니다. 통계 랭킹에는 포함되지 않습니다.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-2">
            <Label htmlFor="guest-name">용병 이름</Label>
            <Input id="guest-name" list="guest-list" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 민수(용병)" maxLength={20} autoFocus />
            <datalist id="guest-list">{recentGuests.map((g) => <option key={g} value={g} />)}</datalist>
            {recentGuests.length > 0 && <p className="text-muted-foreground text-xs">전에 온 용병: {recentGuests.slice(0, 6).join(", ")}</p>}
          </div>
          <DrawerFooter>
            <Button type="submit" size="lg" disabled={pending || !name.trim()}>{pending ? "추가 중…" : "참석자로 추가"}</Button>
            <DrawerClose asChild><Button type="button" variant="ghost" disabled={pending}>취소</Button></DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
