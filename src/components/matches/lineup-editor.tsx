"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyPreviousLineup, setLineup, type LineupRow } from "@/app/actions/games";
import { MatchTypeButton } from "@/components/matches/match-type-button";
import type { LineupEntry } from "@/lib/queries/games";
import type { PlayerRow, PositionType, TeamSide } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = {
  matchId: string;
  gameId: string;
  attendees: PlayerRow[];
  lineup: LineupEntry[];
  perTeam: number; // 6v6 → 6
  hasPrevious: boolean;
  /** 모임 전체 출전 수 (편성 참고용) */
  quartersByPlayer: Map<string, number>;
  /** 상대팀 경기: 우리 출전 선수(A)만 편성. 탭 = 출전 ↔ 휴식 */
  external?: boolean;
};

type Slot = { team: TeamSide; position: PositionType | null };
const POS: (PositionType | null)[] = [null, "GK", "FIXO", "ALA", "PIVO"];

/**
 * 편성 편집기. 참석자 칩을 탭하면 휴식 → A → B → 휴식 순으로 바뀐다.
 * 바뀔 때마다 1초 뒤 자동 저장. 팀 목록에서 이름 옆 포지션을 탭하면 포지션이 바뀐다.
 */
export function LineupEditor({ matchId, gameId, attendees, lineup, perTeam, hasPrevious, quartersByPlayer, external = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Map<string, Slot>>(() => new Map(lineup.map((l) => [l.player_id, { team: l.team, position: l.position }])));
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 로컬 변경 버전. 저장 요청이 시작된 뒤 또 변경됐으면 서버 응답으로 덮어쓰지 않는다
  const version = useRef(0);
  const dirtyRef = useRef(false);

  // 서버 데이터가 바뀌면(복사 등) 동기화 — 저장 안 된 로컬 변경이 있으면 건너뜀
  useEffect(() => {
    if (dirtyRef.current) return;
    setSlots(new Map(lineup.map((l) => [l.player_id, { team: l.team, position: l.position }])));
  }, [lineup]);

  function markDirty(v: boolean) {
    dirtyRef.current = v;
    setDirty(v);
  }

  function persist(next: Map<string, Slot>) {
    if (timer.current) clearTimeout(timer.current);
    const myVersion = version.current;
    timer.current = setTimeout(() => {
      const rows: LineupRow[] = [...next.entries()].map(([player_id, s]) => ({ player_id, team: s.team, position: s.position }));
      startTransition(async () => {
        const r = await setLineup(matchId, gameId, rows);
        if ("error" in r) toast.error(r.error);
        else if (version.current === myVersion) {
          markDirty(false);
          router.refresh();
        }
      });
    }, 800);
  }

  function update(mutate: (m: Map<string, Slot>) => void) {
    version.current += 1;
    markDirty(true);
    setSlots((prev) => {
      const next = new Map(prev);
      mutate(next);
      persist(next);
      return next;
    });
  }

  function cycle(playerId: string) {
    update((m) => {
      const cur = m.get(playerId);
      if (!cur) m.set(playerId, { team: "A", position: null });
      else if (cur.team === "A" && !external) m.set(playerId, { team: "B", position: cur.position });
      else m.delete(playerId);
    });
  }

  /** 팀당 GK 1명. 누르면 지정, 이미 GK면 해제, 같은 팀 다른 GK는 자동 해제 */
  function toggleGk(playerId: string) {
    update((m) => {
      const cur = m.get(playerId);
      if (!cur) return;
      if (cur.position === "GK") { m.set(playerId, { ...cur, position: null }); return; }
      for (const [pid, slot] of m) if (slot.team === cur.team && slot.position === "GK") m.set(pid, { ...slot, position: null });
      m.set(playerId, { ...cur, position: "GK" });
    });
  }

  function cyclePosition(playerId: string) {
    update((m) => {
      const cur = m.get(playerId);
      if (!cur) return;
      const idx = POS.indexOf(cur.position);
      m.set(playerId, { ...cur, position: POS[(idx + 1) % POS.length] });
    });
  }

  function copyPrev() {
    startTransition(async () => {
      const r = await copyPreviousLineup(matchId, gameId);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("직전 쿼터 편성을 복사했습니다");
        router.refresh();
      }
    });
  }

  /** 출전 수가 적은 사람부터 번갈아 A/B 배정 (빠른 초안) */
  function autoFill() {
    update((m) => {
      m.clear();
      const sorted = [...attendees].sort((a, b) => (quartersByPlayer.get(a.id) ?? 0) - (quartersByPlayer.get(b.id) ?? 0) || Math.random() - 0.5);
      if (external) sorted.slice(0, perTeam).forEach((p) => m.set(p.id, { team: "A", position: null }));
      else sorted.slice(0, perTeam * 2).forEach((p, i) => m.set(p.id, { team: i % 2 === 0 ? "A" : "B", position: null }));
    });
  }

  const teamA = attendees.filter((p) => slots.get(p.id)?.team === "A");
  const teamB = attendees.filter((p) => slots.get(p.id)?.team === "B");
  const rest = attendees.filter((p) => !slots.has(p.id));

  function TeamBox({ team, list }: { team: TeamSide; list: PlayerRow[] }) {
    const over = list.length > perTeam;
    return (
      <div className={cn("rounded-xl border p-2", team === "A" ? "border-team-a/40 bg-team-a/5" : "border-team-b/40 bg-team-b/5")}>
        <p className={cn("mb-1 flex items-center justify-between text-xs font-bold", team === "A" ? "text-team-a" : "text-team-b")}>
          <span>{external ? "출전" : `${team}팀`}</span>
          <span className={cn(over && "text-destructive")}>
            {list.length}/{perTeam}
            {list.length > 0 && !list.some((p) => slots.get(p.id)?.position === "GK") && <span className="ml-1 font-normal text-amber-600">GK 미지정</span>}
          </span>
        </p>
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-muted-foreground text-center text-xs">아래 참석자를 탭해 배정</p>
            {team === "B" && !external && (
              <MatchTypeButton
                matchId={matchId}
                opponent={null}
                trigger={<Button type="button" variant="outline" size="sm" className="h-9 text-xs">상대팀 경기로 바꾸기</Button>}
              />
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {list.map((p) => (
              <li key={p.id} className="bg-card flex min-h-11 items-center gap-1 rounded-md border px-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => cycle(p.id)} title="탭: 팀 이동">
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => toggleGk(p.id)}
                  aria-pressed={slots.get(p.id)?.position === "GK"}
                  className={cn("h-8 min-w-9 rounded px-1.5 text-xs font-bold", slots.get(p.id)?.position === "GK" ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground")}
                  title="골키퍼 지정"
                >
                  GK
                </button>
                <button
                  type="button"
                  onClick={() => cyclePosition(p.id)}
                  className="text-muted-foreground bg-muted h-8 min-w-11 rounded px-1.5 text-[11px] font-semibold"
                  title="탭: 포지션 변경"
                >
                  {slots.get(p.id)?.position && slots.get(p.id)?.position !== "GK" ? slots.get(p.id)?.position : "포지션"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {pending ? "저장 중…" : dirty ? "변경됨 (자동 저장)" : "자동 저장됨"}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={autoFill} disabled={pending || attendees.length === 0}>
            <Shuffle /> 자동 편성
          </Button>
          {hasPrevious && (
            <Button type="button" variant="outline" size="sm" onClick={copyPrev} disabled={pending}>
              <Copy /> 직전 편성 복사
            </Button>
          )}
        </div>
      </div>

      <div className={cn("grid gap-2", external ? "grid-cols-1" : "grid-cols-2")}>
        <TeamBox team="A" list={teamA} />
        {!external && <TeamBox team="B" list={teamB} />}
      </div>

      <div className="rounded-xl border p-2">
        <p className="text-muted-foreground mb-1 text-xs font-semibold">
          휴식 {rest.length}명 {attendees.length === 0 ? "· 출석 탭에서 참석자(또는 투표 참석)를 먼저 체크하세요" : external ? "· 이름을 탭하면 출전 ↔ 휴식" : "· 이름을 탭: 한 번 → A팀, 두 번 → B팀, 세 번 → 휴식"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {rest.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => cycle(p.id)}
              className="bg-card hover:bg-accent flex h-11 items-center gap-1 rounded-full border px-3 text-sm"
            >
              {p.name}
              <span className="text-muted-foreground text-[10px] tabular-nums">{quartersByPlayer.get(p.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
