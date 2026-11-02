"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Save, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAttendance, type AttendanceRowInput } from "@/app/actions/attendance";
import { ATTENDANCE_LABEL, type AttendanceRow, type AttendanceStatus, type PlayerRow, type RsvpAnswer } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { matchId: string; players: PlayerRow[]; attendance: AttendanceRow[]; lateThreshold: number; isUpcoming: boolean };

const ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const SHORT: Record<AttendanceStatus, string> = { present: "출석", late: "지각", absent: "결석", excused: "사전" };
const STYLE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-500 text-white",
  absent: "bg-red-500 text-white",
  excused: "bg-neutral-500 text-white",
};

/** 경기 후 비고에 빠르게 넣을 피드백 키워드 (탭하면 추가). 리포트 재료가 된다 */
const KEYWORDS = ["활약", "득점력", "패스", "수비", "체력", "골키퍼", "집중력", "팀워크", "지각", "부상"];

type Row = { rsvp: RsvpAnswer | null; status: AttendanceStatus | null; late_minutes: string; note: string; noteOpen: boolean };

/**
 * 출석 편집기 (scorer 이상).
 * 1열: 투표(사전 참석/불참 — 카톡 투표 결과를 옮겨 적음)
 * 2열: 당일(출석/지각/결석/사전통보). "투표 참석자 전원 출석" 버튼으로 시작해 지각·결석만 바꾼다.
 */
export function AttendanceEditor({ matchId, players, attendance, lateThreshold, isUpcoming }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const p of players) {
      const a = attendance.find((x) => x.player_id === p.id);
      m.set(p.id, { rsvp: a?.rsvp ?? null, status: a?.status ?? null, late_minutes: a?.late_minutes?.toString() ?? "", note: a?.note ?? "", noteOpen: !!a?.note });
    }
    return m;
  }, [players, attendance]);
  const [rows, setRows] = useState<Map<string, Row>>(initial);
  const [dirty, setDirty] = useState(false);
  // 예정 모임은 투표 칸을 먼저, 당일(경기일 이후)은 출석 칸을 강조
  const [showDay, setShowDay] = useState(!isUpcoming || attendance.some((a) => a.status));

  function set(playerId: string, patch: Partial<Row>) {
    setRows((prev) => {
      const next = new Map(prev);
      next.set(playerId, { ...(prev.get(playerId) ?? { rsvp: null, status: null, late_minutes: "", note: "", noteOpen: false }), ...patch });
      return next;
    });
    setDirty(true);
  }

  function toggleRsvp(playerId: string, answer: RsvpAnswer) {
    const cur = rows.get(playerId)?.rsvp ?? null;
    set(playerId, { rsvp: cur === answer ? null : answer });
  }

  function toggleStatus(playerId: string, status: AttendanceStatus) {
    const cur = rows.get(playerId)?.status ?? null;
    set(playerId, { status: cur === status ? null : status, late_minutes: status === "late" && cur !== "late" ? String(lateThreshold) : (rows.get(playerId)?.late_minutes ?? "") });
  }

  /** 투표 참석자 → 출석, 투표 불참자 → 사전통보, 나머지는 그대로 */
  function applyVote() {
    setRows((prev) => {
      const next = new Map(prev);
      for (const p of players) {
        const r = prev.get(p.id);
        if (!r || r.status) continue;
        if (r.rsvp === "yes") next.set(p.id, { ...r, status: "present" });
        else if (r.rsvp === "no") next.set(p.id, { ...r, status: "excused" });
      }
      return next;
    });
    setDirty(true);
    setShowDay(true);
  }

  const voteYes = [...rows.values()].filter((r) => r.rsvp === "yes").length;
  const voteNo = [...rows.values()].filter((r) => r.rsvp === "no").length;
  const dayCounts = ORDER.map((s) => [s, [...rows.values()].filter((r) => r.status === s).length] as const);
  const noShow = [...rows.values()].filter((r) => r.rsvp === "yes" && r.status === "absent").length;

  function save() {
    const payload: AttendanceRowInput[] = players.map((p) => {
      const r = rows.get(p.id)!;
      return { player_id: p.id, rsvp: r.rsvp, status: r.status, late_minutes: r.status === "late" && r.late_minutes !== "" ? Number(r.late_minutes) : null, note: r.note };
    });
    startTransition(async () => {
      const res = await saveAttendance(matchId, payload);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("저장했습니다");
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 요약 + 모드 전환 */}
      <div className="bg-card flex flex-col gap-2 rounded-xl border px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <Vote className="size-4 text-primary" />
            투표 참석 <b>{voteYes}</b> · 불참 <b>{voteNo}</b> · 미응답 <b>{players.length - voteYes - voteNo}</b>
          </span>
          <div className="flex gap-1">
            <Button type="button" variant={showDay ? "ghost" : "secondary"} size="sm" onClick={() => setShowDay(false)}>투표 입력</Button>
            <Button type="button" variant={showDay ? "secondary" : "ghost"} size="sm" onClick={() => setShowDay(true)}>당일 출석</Button>
          </div>
        </div>
        {showDay && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {dayCounts.map(([s, n]) => (
                <span key={s} className="bg-muted rounded-md px-2 py-1">{ATTENDANCE_LABEL[s]} <b>{n}</b></span>
              ))}
              {noShow > 0 && <span className="rounded-md bg-red-100 px-2 py-1 text-red-700">노쇼 <b>{noShow}</b></span>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyVote}>투표 참석자 전원 출석</Button>
          </div>
        )}
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
                  {showDay && r.rsvp && (
                    <span className={cn("ml-1.5 text-[10px] font-semibold", r.rsvp === "yes" ? "text-primary" : "text-muted-foreground")}>
                      투표 {r.rsvp === "yes" ? "참석" : "불참"}
                    </span>
                  )}
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
                {showDay ? (
                  <div className="grid grid-cols-4 gap-1" role="group" aria-label={`${p.name} 당일 출석`}>
                    {ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={r.status === s}
                        onClick={() => toggleStatus(p.id, s)}
                        className={cn("h-11 min-w-11 rounded-md px-1.5 text-xs font-semibold transition-colors", r.status === s ? STYLE[s] : "bg-muted text-muted-foreground hover:bg-accent")}
                      >
                        {SHORT[s]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1" role="group" aria-label={`${p.name} 투표`}>
                    <button
                      type="button"
                      aria-pressed={r.rsvp === "yes"}
                      onClick={() => toggleRsvp(p.id, "yes")}
                      className={cn("h-11 min-w-16 rounded-md px-2 text-xs font-semibold transition-colors", r.rsvp === "yes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}
                    >
                      참석
                    </button>
                    <button
                      type="button"
                      aria-pressed={r.rsvp === "no"}
                      onClick={() => toggleRsvp(p.id, "no")}
                      className={cn("h-11 min-w-16 rounded-md px-2 text-xs font-semibold transition-colors", r.rsvp === "no" ? "bg-neutral-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent")}
                    >
                      불참
                    </button>
                  </div>
                )}
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
                  {!r.status && !r.rsvp && <p className="text-muted-foreground text-xs">비고는 투표 또는 출석 상태를 함께 골라야 저장됩니다.</p>}
                </div>
              )}
              {showDay && r.status === "late" && (
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

      <div className="bg-background/95 sticky z-10 py-2 backdrop-blur" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <Button size="lg" className="w-full" onClick={save} disabled={pending || !dirty}>
          <Save /> {pending ? "저장 중…" : dirty ? "저장" : "저장됨"}
        </Button>
      </div>
    </div>
  );
}
