"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { MultiDatePicker } from "@/components/matches/multi-date-picker";
import { createMatches, updateMatch } from "@/app/actions/matches";
import { formatDateShort } from "@/lib/date";
import type { MatchFormat, MatchRow } from "@/types/database";

type Props = {
  /** 수정 모드면 기존 모임 */
  match?: MatchRow;
  trigger: ReactNode;
  defaultFormat?: MatchFormat;
  defaultTime?: string; // HH:MM
  recentVenues?: string[];
  recentOpponents?: string[];
};

/** 모임 만들기(여러 날짜 한 번에) / 수정 바텀시트. scorer 이상만 트리거를 렌더링할 것 */
export function MatchFormDrawer({ match, trigger, defaultFormat = "6v6", defaultTime = "10:00", recentVenues = [], recentOpponents = [] }: Props) {
  const router = useRouter();
  const isEdit = !!match;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [dates, setDates] = useState<string[]>(match ? [match.match_date] : []);
  const [time, setTime] = useState(match?.start_time?.slice(0, 5) ?? defaultTime);
  const [venue, setVenue] = useState(match?.venue ?? recentVenues[0] ?? "");
  const [format, setFormat] = useState<MatchFormat>(match?.format ?? defaultFormat);
  const [notes, setNotes] = useState(match?.notes ?? "");
  const [external, setExternal] = useState(!!match?.opponent);
  const [opponent, setOpponent] = useState(match?.opponent ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (external && !opponent.trim()) { toast.error("상대팀 이름을 입력해 주세요."); return; }
    const common = { start_time: time || null, venue: venue || null, format, notes: notes || null, opponent: external ? opponent.trim() : null };
    startTransition(async () => {
      const result = isEdit
        ? await updateMatch(match.id, { match_date: dates[0], ...common })
        : await createMatches(dates, common);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "모임 정보를 저장했습니다" : `${result.count}개 일정을 등록했습니다`);
      setOpen(false);
      if (!isEdit) setDates([]);
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "모임 수정" : "모임 일정 등록"}</DrawerTitle>
            <DrawerDescription>
              {isEdit ? "날짜·시간·장소·형식을 바꿉니다." : "달력에서 날짜를 여러 개 고르면 같은 시간·장소로 한 번에 등록됩니다."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
            <MultiDatePicker value={dates} onChange={setDates} single={isEdit} />
            {!isEdit && dates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dates.map((d) => (
                  <span key={d} className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium">
                    {formatDateShort(d)}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>경기 유형</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={external ? "outline" : "default"} onClick={() => setExternal(false)}>자체전 (A팀 vs B팀)</Button>
                <Button type="button" variant={external ? "default" : "outline"} onClick={() => setExternal(true)}>상대팀 경기</Button>
              </div>
              {external && (
                <>
                  <Input list="opponent-list" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="상대팀 이름 (예: FC 강남)" maxLength={40} autoFocus />
                  <datalist id="opponent-list">
                    {recentOpponents.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-time">시작 시간</Label>
                <Input id="m-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-format">형식</Label>
                <NativeSelect id="m-format" value={format} onChange={(e) => setFormat(e.target.value as MatchFormat)}>
                  <option value="6v6">6 대 6</option>
                  <option value="5v5">5 대 5</option>
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-venue">장소</Label>
              <Input id="m-venue" list="venue-list" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="예: 한강 풋살파크 A구장" maxLength={60} />
              <datalist id="venue-list">
                {recentVenues.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-notes">메모</Label>
              <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="선택 (예: 구장 예약 완료, 회비 안내)" maxLength={300} className="min-h-16" />
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" size="lg" disabled={pending || dates.length === 0}>
              {pending ? "저장 중…" : isEdit ? "저장" : dates.length > 1 ? `${dates.length}개 일정 등록` : "등록"}
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>취소</Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
