"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseISODate, todayISO, toISODate } from "@/lib/date";
import { cn } from "@/lib/utils";

type Props = {
  value: string[]; // 선택된 날짜들 (YYYY-MM-DD)
  onChange: (dates: string[]) => void;
  /** 단일 선택 모드 (수정 폼) */
  single?: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 달력에서 날짜를 탭해 여러 개 고르는 간단한 선택기 (라이브러리 없음).
 * 한 달치 일정을 한 번에 예약할 때 사용. 요일 제한 없음.
 */
export function MultiDatePicker({ value, onChange, single = false }: Props) {
  const today = todayISO();
  const base = value[0] ? parseISODate(value[0]) : parseISODate(today);
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const leading = first.getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(cursor.y, cursor.m, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selected = new Set(value);

  function toggle(iso: string) {
    if (single) {
      onChange([iso]);
      return;
    }
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange([...next].sort());
  }

  function move(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  return (
    <div className="rounded-lg border p-2">
      <div className="mb-1 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => move(-1)} aria-label="이전 달">
          <ChevronLeft />
        </Button>
        <p className="font-semibold">
          {cursor.y}년 {cursor.m + 1}월
        </p>
        <Button type="button" variant="ghost" size="icon" onClick={() => move(1)} aria-label="다음 달">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={cn("text-muted-foreground py-1 text-xs", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
            {w}
          </div>
        ))}
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`e${idx}`} />;
          const day = Number(iso.slice(8, 10));
          const isSel = selected.has(iso);
          const isToday = iso === today;
          const isPast = iso < today;
          const dow = idx % 7;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => toggle(iso)}
              aria-pressed={isSel}
              className={cn(
                "mx-auto my-0.5 flex size-11 items-center justify-center rounded-full text-sm transition-colors",
                isSel ? "bg-primary text-primary-foreground font-bold" : "hover:bg-accent",
                !isSel && isPast && "text-muted-foreground/60",
                !isSel && !isPast && dow === 0 && "text-red-500",
                !isSel && !isPast && dow === 6 && "text-blue-500",
                isToday && !isSel && "ring-primary ring-2",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      {!single && (
        <p className="text-muted-foreground mt-1 px-1 text-xs">
          {value.length === 0 ? "날짜를 탭해서 선택 (여러 개 가능)" : `${value.length}개 선택됨`}
          {value.length > 0 && (
            <button type="button" className="text-primary ml-2 underline-offset-2 hover:underline" onClick={() => onChange([])}>
              모두 해제
            </button>
          )}
        </p>
      )}
    </div>
  );
}
