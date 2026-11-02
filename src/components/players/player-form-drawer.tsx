"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { createPlayer, updatePlayer, type PlayerInput } from "@/app/actions/players";
import { todayISO } from "@/lib/date";
import { POSITION_LABEL, type PlayerRow, type PositionType } from "@/types/database";

type Props = {
  /** 수정 모드면 기존 선수, 추가 모드면 undefined */
  player?: PlayerRow;
  /** 바텀시트를 여는 버튼 */
  trigger: ReactNode;
};

const POSITIONS = Object.keys(POSITION_LABEL) as PositionType[];

/** 선수 추가/수정 바텀시트 (admin 전용 — 호출하는 쪽에서 권한 확인 후 렌더링) */
export function PlayerFormDrawer({ player, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = !!player;

  const [name, setName] = useState(player?.name ?? "");
  const [nickname, setNickname] = useState(player?.nickname ?? "");
  const [position, setPosition] = useState<PositionType>(player?.preferred_position ?? "ANY");
  const [jersey, setJersey] = useState(player?.jersey_number?.toString() ?? "");
  const [joinedAt, setJoinedAt] = useState(player?.joined_at ?? todayISO());
  const [active, setActive] = useState(player?.is_active ?? true);

  function reset() {
    setName(player?.name ?? "");
    setNickname(player?.nickname ?? "");
    setPosition(player?.preferred_position ?? "ANY");
    setJersey(player?.jersey_number?.toString() ?? "");
    setJoinedAt(player?.joined_at ?? todayISO());
    setActive(player?.is_active ?? true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: PlayerInput = {
      name,
      nickname: nickname || null,
      preferred_position: position,
      jersey_number: jersey.trim() === "" ? null : Number(jersey),
      is_active: active,
      joined_at: joinedAt,
    };
    startTransition(async () => {
      const result = isEdit ? await updatePlayer(player.id, input) : await createPlayer(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "선수 정보를 저장했습니다" : `${input.name.trim()} 선수를 등록했습니다`);
      setOpen(false);
      if (!isEdit) reset();
      router.refresh();
    });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "선수 정보 수정" : "선수 등록"}</DrawerTitle>
            <DrawerDescription>
              {isEdit ? "기록은 보존되며, 그만둔 선수는 '활동 중'을 끄면 됩니다." : "이름만 있으면 바로 등록됩니다. 나머지는 나중에 수정 가능."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-name">이름 *</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={20} autoFocus={!isEdit} placeholder="홍길동" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-nick">별명</Label>
                <Input id="p-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="선택" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-jersey">등번호</Label>
                <Input
                  id="p-jersey"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="선택"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-pos">선호 포지션</Label>
              <NativeSelect id="p-pos" value={position} onChange={(e) => setPosition(e.target.value as PositionType)}>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABEL[p]} ({p})
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-joined">가입일</Label>
              <Input id="p-joined" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-3">
              <div>
                <Label htmlFor="p-active">활동 중</Label>
                <p className="text-muted-foreground mt-1 text-xs">끄면 목록 아래 &quot;비활성&quot; 으로 내려가고 편성에서 제외됩니다</p>
              </div>
              <Switch id="p-active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" size="lg" disabled={pending || !name.trim()}>
              {pending ? "저장 중…" : isEdit ? "저장" : "등록"}
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                취소
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
