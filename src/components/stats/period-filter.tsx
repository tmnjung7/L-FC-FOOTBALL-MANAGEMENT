"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { Period, PeriodKey } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

const PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "year", label: "올해" },
  { key: "3m", label: "최근 3개월" },
  { key: "all", label: "전체" },
];

/** 상단 기간 필터. URL ?period= 로 유지 (공유·뒤로가기 가능) */
export function PeriodFilter({ period }: { period: Period }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [from, setFrom] = useState(period.from ?? "");
  const [to, setTo] = useState(period.to ?? "");

  function go(params: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/stats?${next.toString()}`);
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => go({ period: p.key, from: null, to: null })}
          aria-pressed={period.key === p.key}
          className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-medium", period.key === p.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}
        >
          {p.label}
        </button>
      ))}
      <Drawer>
        <DrawerTrigger asChild>
          <button type="button" aria-pressed={period.key === "custom"} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-medium", period.key === "custom" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>
            {period.key === "custom" ? period.label : "직접 선택"}
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>기간 직접 선택</DrawerTitle>
            <DrawerDescription>시작일과 종료일을 고르세요 (월말·분기 결산용)</DrawerDescription>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-3 px-4 pb-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일" />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button size="lg" disabled={!from} onClick={() => go({ period: "custom", from, to: to || null })}>적용</Button>
            </DrawerClose>
            <DrawerClose asChild><Button variant="ghost">취소</Button></DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
