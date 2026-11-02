"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAttendance, type AttendanceRowInput } from "@/app/actions/attendance";
import { ATTENDANCE_LABEL, type AttendanceRow, type AttendanceStatus, type PlayerRow } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { matchId: string; players: PlayerRow[]; attendance: AttendanceRow[]; lateThreshold: number };

const ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const STYLE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-500 text-white",
  absent: "bg-red-500 text-white",
  excused: "bg-neutral-500 text-white",
};

type Row = { status: AttendanceStatus | null; late_minutes: string; note: string; noteOpen: boolean };

/** 경기 후 비고에 빠르게 넣을 피드백 키워드 (탭하면 추가). 리포트 재료가 된다 */
const KEYWORDS = ["활약", "득점력", "패스", "수비", "체력", "골키퍼", "집중력", "팀워크", "지각", "부상"];

/** 출석 탭 편집기 (scorer 이상). 각 행에 4개 토글, 지각은 분 입력, 한 번에 저장 */
export function AttendanceEditor({ matchId, players, attendance, lateThreshold }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const p of players) {
      const a = attendance.find((x) => x.player_id === p.id);
      m.set(p.id, { status: a?.status ?? null, late_minutes: a?.late_minutes?.toString() ?? "", note: a?.note ?? "", noteOpen: !!a?.note });
    }
    return m;
  }, [players, attendance]);
  const [rows, setRows] = useState<Map<string, Row>>(initial);
  const [dirty, setDirty] = useState(false);

  function set(playerId: string, patch: Partial<Row>) {
    setRows((prev) => {
      const next = new Map(prev);
      next.set(playerId, { ...(prev.get(playerId) ?? { status: null, late_minutes: "", note: "", noteOpen: false }), ...patch });
      return next;
    });
    setDirty(true);
  }

  function toggle(playerId: string, status: AttendanceStatus) {
    const cur = rows.get(playerId)?.status ?? null;
    set(playerId, { status: cur === status ? null : status, late_minutes: status === "late" && cur !== "late" ? String(lateThreshold) : rows.get(playerId)?.late_minutes ?? "" });
  }

  function markAllPresent() {
    setRows((prev) => {
      const next = new Map(prev);
      for (const p of players) if (!(prev.get(p.id)?.status)) next.set(p.id, { ...(prev.get(p.id) ?? { note: "", noteOpen: false }), status: "present", late_minutes: "" });
      return next;
    });
    setDirty(true);
  }

  const counts = ORDER.map((s) => [s, [...rows.values()].filter((r) => r.status === s).length] as const);

  function save() {
    const payload: AttendanceRowInput[] = players.map((p) => {
      const r = rows.get(p.id)!;
      return { player_id: p.id, status: r.status, late_minutes: r.status === "late" && r.late_minutes !== "" ? Number(r.late_minutes) : null, note: r.note };
    });
    startTransition(async () => {
      const res = await saveAttendance(matchId, payload);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("출석을 저장했습니다");
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-2">
          {counts.map(([s, n]) => (
            <span key={s} className="bg-muted rounded-md px-2 py-1">
              {ATTENDANCE_LABEL[s]} <b>{n}</b>
            </span>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={markAllPresent}>미입력 전원 출석</Button>
      </div>

      <ul className="bg-card divide-y rounded-xl border shadow-sm">
        {players.map((p) => {
          const r = rows.get(p.id)!;
          return (
            <li key={p.id} className="flex flex-col gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn("min-w-0 flex-1 truncate font-medium", !p.is_active && "text-muted-foreground")}>
                  {p.name}
                  {!p.is_active && <span className="ml-1 text-xs">(비활성)</span>}
                </span>
                <button
                  type="button"
                  aria-label="비고(피드백) 입력"
                  aria-pressed={r.noteOpen}
                  onClick={() => set(p.id, { noteOpen: !r.noteOpen })}
                  className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", r.note ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent")}
                >
                  <MessageSquarePlus className="size-4" />
                </button>
                <div className="grid grid-cols-4 gap-1" role="group" aria-label={`${p.name} 출석`}>
                  {ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={r.status === s}
                      onClick={() => toggle(p.id, s)}
                      className={cn(
                        "h-11 min-w-11 rounded-md px-2 text-xs font-semibold transition-colors",
                        r.status === s ? STYLE[s] : "bg-muted text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {ATTENDANCE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              {r.noteOpen && (
                <div className="flex flex-col gap-1.5">
                  <Input
                    value={r.note}
                    onChange={(e) => set(p.id, { note: e.target.value.slice(0, 120) })}
                    placeholder="비고 · 피드백 키워드 (예: 활약, 수비 집중)"
                    className="h-10 text-sm"
                    aria-label={`${p.name} 비고`}
                  />
                  <div className="flex flex-wrap gap-1">
                    {KEYWORDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set(p.id, { note: r.note ? (r.note.split(/,\s*/).includes(k) ? r.note : `${r.note}, ${k}`) : k })}
                        className="bg-muted hover:bg-accent h-8 rounded-full px-2.5 text-xs"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  {!r.status && <p className="text-muted-foreground text-xs">비고는 출석 상태를 함께 골라야 저장됩니다.</p>}
                </div>
              )}
              {r.status === "late" && (
                <div className="flex items-center justify-end gap-2 text-sm">
                  <span className="text-muted-foreground">지각</span>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="h-10 w-20 text-center"
                    value={r.late_minutes}
                    onChange={(e) => set(p.id, { late_minutes: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    aria-label="지각 분"
                  />
                  <span className="text-muted-foreground">분</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="bg-background/95 sticky bottom-16 z-10 py-2 backdrop-blur" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <Button size="lg" className="w-full" onClick={save} disabled={pending || !dirty}>
          <Save /> {pending ? "저장 중…" : dirty ? "출석 저장" : "저장됨"}
        </Button>
      </div>
    </div>
  );
}
