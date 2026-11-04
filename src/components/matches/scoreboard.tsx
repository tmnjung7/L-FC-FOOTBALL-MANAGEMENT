"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickGoalDrawer } from "@/components/matches/quick-goal-drawer";
import type { GameFull } from "@/lib/queries/games";
import { cn } from "@/lib/utils";

type Props = { matchId: string; current: GameFull; games?: GameFull[]; canScore: boolean };

type TimerState = { running: boolean; endAt: number | null; remainingMs: number };

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 경기 중 빠른 입력 모드: 큰 스코어보드 + 쿼터 타이머 + 각 팀 "골" 버튼.
 * 타이머는 종료 시각(endAt)을 저장해 두므로 화면이 꺼졌다 켜져도 정확하다. 끝나면 진동.
 */
export function Scoreboard({ matchId, current, games, canScore }: Props) {
  const { game } = current;
  const total = game.duration_min * 60_000;
  const key = `fm:timer:${game.id}`;
  const [t, setT] = useState<TimerState>({ running: false, endAt: null, remainingMs: total });
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  // 저장된 타이머 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as TimerState;
        setT(saved);
        fired.current = saved.running ? false : saved.remainingMs <= 0;
      }
    } catch {}
  }, [key]);

  const save = useCallback((s: TimerState) => {
    setT(s);
    try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
  }, [key]);

  useEffect(() => {
    if (!t.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [t.running]);

  const remaining = t.running && t.endAt ? t.endAt - now : t.remainingMs;

  useEffect(() => {
    if (t.running && remaining <= 0 && !fired.current) {
      fired.current = true;
      save({ running: false, endAt: null, remainingMs: 0 });
      try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {}
    }
  }, [remaining, t.running, save]);

  function start() { fired.current = false; save({ running: true, endAt: Date.now() + Math.max(t.remainingMs, 0), remainingMs: t.remainingMs }); }
  function pause() { save({ running: false, endAt: null, remainingMs: Math.max(remaining, 0) }); }
  function reset() { fired.current = false; save({ running: false, endAt: null, remainingMs: total }); }

  const ended = remaining <= 0;
  /** 경과 분 (타이머 기준). 타이머를 안 썼으면 null */
  const getMinute = () => {
    const elapsed = total - Math.max(remaining, 0);
    if (!t.running && t.remainingMs === total) return null;
    return Math.min(game.duration_min, Math.max(0, Math.ceil(elapsed / 60_000)));
  };

  return (
    <div className="bg-card rounded-2xl border p-4 shadow-sm">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <p className="text-team-a text-xs font-bold">A팀</p>
          <p className="text-team-a text-6xl font-black tabular-nums">{game.team_a_score}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-xs">Q{game.game_number}</p>
          <p className={cn("font-mono text-3xl font-bold tabular-nums", ended ? "text-destructive" : t.running ? "text-primary" : "")}>{fmt(remaining)}</p>
          <p className="text-muted-foreground text-[10px]">{game.duration_min}분</p>
        </div>
        <div className="text-center">
          <p className="text-team-b text-xs font-bold">B팀</p>
          <p className="text-team-b text-6xl font-black tabular-nums">{game.team_b_score}</p>
        </div>
      </div>

      {canScore && (
        <>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <QuickGoalDrawer
              matchId={matchId}
              gameId={game.id}
              team="A"
              lineup={current.lineup}
              getMinute={getMinute}
              trigger={
                <Button size="lg" className="bg-team-a hover:bg-team-a/90 h-16 w-full text-xl" disabled={current.lineup.length === 0}>
                  <Target className="size-6" /> A팀 골!
                </Button>
              }
            />
            <div className="flex flex-col gap-1">
              {t.running ? (
                <Button variant="outline" size="icon" className="size-12" onClick={pause} aria-label="일시정지"><Pause /></Button>
              ) : (
                <Button variant="outline" size="icon" className="size-12" onClick={start} disabled={ended} aria-label="시작"><Play /></Button>
              )}
              <Button variant="ghost" size="icon" className="size-10" onClick={reset} aria-label="타이머 초기화"><RotateCcw className="size-4" /></Button>
            </div>
            <QuickGoalDrawer
              matchId={matchId}
              gameId={game.id}
              team="B"
              lineup={current.lineup}
              getMinute={getMinute}
              trigger={
                <Button size="lg" className="bg-team-b hover:bg-team-b/90 h-16 w-full text-xl" disabled={current.lineup.length === 0}>
                  <Target className="size-6" /> B팀 골!
                </Button>
              }
            />
          </div>
          {current.lineup.length === 0 && <p className="text-muted-foreground mt-2 text-center text-xs">골 버튼은 편성(①)을 먼저 하면 켜집니다</p>}
          {ended && <p className="text-destructive mt-2 text-center text-sm font-semibold">쿼터 종료! 아래 &lsquo;다음 쿼터&rsquo;로 편성을 복사해 바로 시작하세요.</p>}
        </>
      )}
    </div>
  );
}
