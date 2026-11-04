"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { PlayerSeasonStatsRow } from "@/types/database";
import { cn } from "@/lib/utils";

type Col = { key: keyof PlayerSeasonStatsRow | "points" | "gk"; label: string; fmt?: (r: PlayerSeasonStatsRow) => string; numeric?: boolean };

const COLS: Col[] = [
  { key: "name", label: "선수" },
  { key: "matches_played", label: "참석", numeric: true },
  { key: "quarters_played", label: "출전Q", numeric: true },
  { key: "rest_quarters", label: "휴식Q", numeric: true },
  { key: "gk", label: "GK", numeric: true, fmt: (r) => String(r.positions_played?.GK ?? 0) },
  { key: "goals", label: "골", numeric: true },
  { key: "assists", label: "도움", numeric: true },
  { key: "points", label: "공격P", numeric: true, fmt: (r) => String(r.goals + r.assists) },
  { key: "avg_rating", label: "평점", numeric: true, fmt: (r) => (r.avg_rating != null ? Number(r.avg_rating).toFixed(2) : "-") },
  { key: "attendance_rate", label: "출석%", numeric: true, fmt: (r) => (r.attendance_rate != null ? String(Math.round(Number(r.attendance_rate))) : "-") },
  { key: "late_count", label: "지각", numeric: true },
  { key: "absent_count", label: "결석", numeric: true },
  { key: "no_show_count", label: "노쇼", numeric: true },
  { key: "wins", label: "승", numeric: true },
  { key: "draws", label: "무", numeric: true },
  { key: "losses", label: "패", numeric: true },
  { key: "main_position", label: "주포지션", fmt: (r) => r.main_position ?? "-" },
];

function val(r: PlayerSeasonStatsRow, key: Col["key"]): number | string | null {
  if (key === "points") return r.goals + r.assists;
  if (key === "gk") return r.positions_played?.GK ?? 0;
  const v = r[key];
  if (v == null) return null;
  if (typeof v === "object") return null;
  return typeof v === "boolean" ? Number(v) : (v as number | string);
}

/** 전 선수 × 모든 지표. 열 헤더 탭으로 정렬. 태블릿은 전체 열, 휴대폰은 가로 스크롤 (이름 열 고정) */
export function StatsTable({ rows }: { rows: PlayerSeasonStatsRow[] }) {
  const [sort, setSort] = useState<{ key: Col["key"]; dir: "asc" | "desc" }>({ key: "goals", dir: "desc" });

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = val(a, sort.key), bv = val(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? c : -c;
    });
    return list;
  }, [rows, sort]);

  function toggle(key: Col["key"]) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  }

  return (
    <div className="bg-card overflow-x-auto rounded-xl border shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground text-xs">
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={cn("px-2 py-2 font-medium whitespace-nowrap", c.key === "name" ? "bg-muted/60 sticky left-0 z-10 text-left" : "text-center")}>
                <button type="button" onClick={() => toggle(c.key)} className="inline-flex min-h-8 items-center gap-0.5">
                  {c.label}
                  {sort.key === c.key && (sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((r) => (
            <tr key={r.player_id} className={cn(!r.is_active && "text-muted-foreground")}>
              {COLS.map((c) => (
                <td key={c.key} className={cn("px-2 py-2 whitespace-nowrap", c.key === "name" ? "bg-card sticky left-0 z-10 font-medium" : "text-center tabular-nums")}>
                  {c.key === "name" ? <Link href={`/players/${r.player_id}`} className="underline-offset-4 hover:underline">{r.name}</Link> : c.fmt ? c.fmt(r) : String(val(r, c.key) ?? "-")}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={COLS.length} className="text-muted-foreground px-3 py-6 text-center">선수가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
