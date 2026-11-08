"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setGameTimer } from "@/app/actions/games";
import { Pause, Play, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickGoalDrawer } from "@/components/matches/quick-goal-drawer";
import { ConcedeDrawer } from "@/components/matches/concede-drawer";
import type { GameFull } from "@/lib/queries/games";
import { cn } from "@/lib/utils";

type Props = { matchId: string; current: GameFull; games?: GameFull[]; canScore: boolean; opponent?: string | null };

/**
 * 공유 타이머: 상태는 DB(games.timer_*)에 있고, 이 컴포넌트는 그 값을 바탕으로 초를 센다.
 * 시작/정지/초기화는 대표가 누르면 DB 에 기록되고, 다른 휴대폰은 AutoRefresh(5초)로 같은 값을 받는다.
 */
function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Scoreboard({ matchId, current, canScore, opponent = null }: Props) {
  const labelA = opponent ? "우리" : "A팀";
  const labelB = opponent ? opponent : "B팀";
  const router = useRouter();
  const { game } = current;
  const total = game.duration_min * 60_000;
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<string | null>(null);

  // 서버 값(props)을 그대로 쓰되, 버튼을 누른 직후에는 낙관적으로 먼저 반영
  const [local, setLocal] = useState<{ running: boolean; endAt: number | null; remainingMs: number } | null>(null);
  useEffect(() => { setLocal(null); }, [game.timer_running, game.timer_end_at, game.timer_remaining_ms]);
  const t = local ?? {
    running: game.timer_running,
    endAt: game.timer_end_at ? new Date(game.timer_end_at).getTime() : null,
    remainingMs: game.timer_remaining_ms ?? total,
  };

  useEffect(() => {
    if (!t.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [t.running]);

  const remaining = t.running && t.endAt ? t.endAt - now : t.remainingMs;

  // 종료 시 진동 (쿼터당 1회)
  useEffect(() => {
    if (t.running && remaining <= 0 && fired.current !== game.id) {
      fired.current = game.id;
      try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch {}
      if (canScore) persist({ running: false, endAt: null, remainingMs: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, t.running, game.id]);

  function persist(next: { running: boolean; endAt: number | null; remainingMs: number }) {
    setLocal(next);
    startTransition(async () => {
      const r = await setGameTimer(matchId, game.id, { running: next.running, end_at: next.endAt ? new Date(next.endAt).toISOString() : null, remaining_ms: next.remainingMs });
      if ("error" in r) toast.error(r.error);
      else router.refresh();
    });
  }
  function start() { persist({ running: true, endAt: Date.now() + Math.max(t.remainingMs, 0), remainingMs: t.remainingMs }); }
  function pause() { persist({ running: false, endAt: null, remainingMs: Math.max(remaining, 0) }); }
  function reset() { fired.current = null; persist({ running: false, endAt: null, remainingMs: total }); }

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
          <p className="text-team-a truncate text-xs font-bold">{labelA}</p>
          <p className="text-team-a text-6xl font-black tabular-nums">{game.team_a_score}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-xs">Q{game.game_number}</p>
          <p className={cn("font-mono text-3xl font-bold tabular-nums", ended ? "text-destructive" : t.running ? "text-primary" : "")}>{fmt(remaining)}</p>
          <p className="text-muted-foreground text-[10px]">{game.duration_min}분{t.running ? " · 진행 중" : ""}</p>
        </div>
        <div className="text-center">
          <p className="text-team-b truncate text-xs font-bold">{labelB}</p>
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
                  <Target className="size-6" /> {opponent ? "득점!" : "A팀 골!"}
                </Button>
              }
            />
            <div className="flex flex-col gap-1">
              {t.running ? (
                <Button variant="outline" size="icon" className="size-12" onClick={pause} disabled={pending} aria-label="일시정지"><Pause /></Button>
              ) : (
                <Button variant="outline" size="icon" className="size-12" onClick={start} disabled={ended || pending} aria-label="시작"><Play /></Button>
              )}
              <Button variant="ghost" size="icon" className="size-10" onClick={reset} disabled={pending} aria-label="타이머 초기화"><RotateCcw className="size-4" /></Button>
            </div>
            {opponent ? (
              <ConcedeDrawer
                matchId={matchId}
                gameId={game.id}
                opponent={opponent}
                lineup={current.lineup}
                getMinute={getMinute}
                trigger={
                  <Button size="lg" className="bg-team-b hover:bg-team-b/90 h-16 w-full text-xl">
                    <Target className="size-6" /> 실점
                  </Button>
                }
              />
            ) : (
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
            )}
          </div>
          {current.lineup.length === 0 && <p className="text-muted-foreground mt-2 text-center text-xs">{opponent ? "득점 버튼은 출전 선수(①)를 먼저 정하면 켜집니다" : "골 버튼은 편성(①)을 먼저 하면 켜집니다"}</p>}
          {ended && <p className="text-destructive mt-2 text-center text-sm font-semibold">쿼터 종료! 아래 &lsquo;다음 쿼터&rsquo;로 편성을 복사해 바로 시작하세요.</p>}
        </>
      )}
    </div>
  );
}
