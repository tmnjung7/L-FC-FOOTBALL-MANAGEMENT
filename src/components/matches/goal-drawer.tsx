"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { addGoal } from "@/app/actions/events";
import type { GameFull } from "@/lib/queries/games";
import type { TeamSide } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = {
  matchId: string;
  games: GameFull[];
  /** 기본 선택 쿼터 (경기 중 모드에서는 현재 쿼터) */
  defaultGameId?: string;
  /** 골 버튼에서 열 때 미리 정해진 팀 */
  presetTeam?: TeamSide;
  /** 쿼터 선택 숨김 (쿼터 화면에서) */
  lockGame?: boolean;
  trigger: ReactNode;
  /** 저장 후 바로 닫고 다음 골 입력을 위해 초기화 */
  onSaved?: () => void;
  /** 상대팀 경기면 상대 이름 (B = 상대, 득점자 없이 실점 기록 가능) */
  opponent?: string | null;
};

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: "A" | "B" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
        active ? (color === "B" ? "bg-team-b border-team-b text-white" : "bg-team-a border-team-a text-white") : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/**
 * "+ 득점" 바텀시트. 순서: [팀] → [득점자] → [어시스트(선택)] → [분(선택)] → 저장.
 * 득점자·어시스트 후보는 그 쿼터에 출전한 선수만 보여준다.
 */
export function GoalDrawer({ matchId, games, defaultGameId, presetTeam, lockGame = false, trigger, onSaved, opponent = null }: Props) {
  const external = !!opponent;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [gameId, setGameId] = useState(defaultGameId ?? games[games.length - 1]?.game?.id ?? "");
  const [team, setTeam] = useState<TeamSide>(presetTeam ?? "A");
  const [ownGoal, setOwnGoal] = useState(false);
  const [scorer, setScorer] = useState<string | null>(null);
  const [assist, setAssist] = useState<string | null>(null);
  const [minute, setMinute] = useState("");

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      // 열 때마다 초기화 (열려 있는 동안 서버 새로고침이 와도 선택은 유지)
      setTeam(presetTeam ?? "A");
      setGameId(defaultGameId ?? games[games.length - 1]?.game?.id ?? "");
      setScorer(null);
      setAssist(null);
      setOwnGoal(false);
      setMinute("");
    }
  }

  const game = useMemo(() => games.find((g) => g.game.id === gameId), [games, gameId]);
  const scoringTeam = team;
  const scorerTeam: TeamSide = ownGoal ? (team === "A" ? "B" : "A") : team;
  const scorerCandidates = game?.lineup.filter((l) => l.team === scorerTeam) ?? [];
  const assistCandidates = game?.lineup.filter((l) => l.team === scoringTeam && l.player_id !== scorer) ?? [];

  // 상대팀 경기의 실점(B 득점)은 득점자 없이 저장 가능 (자책골이면 우리 선수)
  const concede = external && team === "B";
  const canSave = !!game && (concede ? (!ownGoal || !!scorer) : !!scorer);

  function save() {
    if (!game || !canSave) return;
    startTransition(async () => {
      const r = await addGoal(matchId, game.game.id, {
        team: scoringTeam,
        scorer_id: concede && !ownGoal ? null : scorer,
        assist_id: ownGoal ? null : assist,
        minute: minute === "" ? null : Number(minute),
        is_own_goal: ownGoal,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const name = scorerCandidates.find((c) => c.player_id === scorer)?.name ?? "";
      toast.success(concede && !ownGoal ? `실점 (${opponent})` : `${external ? (scoringTeam === "A" ? "우리" : opponent) : scoringTeam + "팀"} 득점 · ${name}${ownGoal ? " (자책)" : ""}`);
      setOpen(false);
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>득점 입력</DrawerTitle>
          <DrawerDescription>팀 → 득점자 → 어시스트(선택) 순서로 누르면 끝.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
          {!lockGame && games.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>쿼터</Label>
              <NativeSelect value={gameId} onChange={(e) => { setGameId(e.target.value); setScorer(null); setAssist(null); }}>
                {games.map((g) => (
                  <option key={g.game.id} value={g.game.id}>
                    Q{g.game.game_number} ({g.game.team_a_score}:{g.game.team_b_score})
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>득점 팀</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="lg" variant={team === "A" ? "default" : "outline"} className={cn(team === "A" && "bg-team-a hover:bg-team-a/90")} onClick={() => { setTeam("A"); setScorer(null); setAssist(null); }}>{external ? "우리 득점" : "A팀"}</Button>
              <Button type="button" size="lg" variant={team === "B" ? "default" : "outline"} className={cn(team === "B" && "bg-team-b hover:bg-team-b/90")} onClick={() => { setTeam("B"); setScorer(null); setAssist(null); }}>{external ? `실점 (${opponent})` : "B팀"}</Button>
            </div>
          </div>

          {(!external || team === "B") && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="own-goal" className="text-sm">{external ? "우리 선수 자책골" : "자책골 (상대팀 선수가 넣음)"}</Label>
              <Switch id="own-goal" checked={ownGoal} onCheckedChange={(v) => { setOwnGoal(v); setScorer(null); setAssist(null); }} />
            </div>
          )}

          {concede && !ownGoal ? (
            <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-sm">상대 득점자는 기록하지 않습니다. 바로 저장하세요.</p>
          ) : (
          <div className="flex flex-col gap-2">
            <Label>{ownGoal ? `자책골 선수 (${external ? "우리" : scorerTeam + "팀"})` : "득점자"}</Label>
            {!game || scorerCandidates.length === 0 ? (
              <p className="text-muted-foreground text-sm">이 쿼터의 {scorerTeam}팀 편성이 없습니다. 쿼터 화면에서 편성을 먼저 해 주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {scorerCandidates.map((c) => (
                  <Chip key={c.player_id} active={scorer === c.player_id} color={scorerTeam} onClick={() => { setScorer(c.player_id); if (assist === c.player_id) setAssist(null); }}>
                    {c.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          )}

          {!ownGoal && scorer && !concede && (
            <div className="flex flex-col gap-2">
              <Label>어시스트 (선택)</Label>
              <div className="flex flex-wrap gap-2">
                <Chip active={assist === null} color={team} onClick={() => setAssist(null)}>없음</Chip>
                {assistCandidates.map((c) => (
                  <Chip key={c.player_id} active={assist === c.player_id} color={team} onClick={() => setAssist(c.player_id)}>
                    {c.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label htmlFor="goal-minute" className="shrink-0">분 (선택)</Label>
            <Input id="goal-minute" inputMode="numeric" pattern="[0-9]*" className="w-24" value={minute} onChange={(e) => setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="예: 7" />
          </div>
        </div>
        <DrawerFooter>
          <Button size="lg" onClick={save} disabled={pending || !canSave}>
            {pending ? "저장 중…" : concede && !ownGoal ? "실점 저장" : "득점 저장"}
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost" disabled={pending}>취소</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
