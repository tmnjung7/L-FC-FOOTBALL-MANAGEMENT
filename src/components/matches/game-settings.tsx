"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteGame, updateGame } from "@/app/actions/games";
import type { GameRow, TacticRow } from "@/types/database";

type Props = { matchId: string; game: GameRow; tactics: Pick<TacticRow, "id" | "name" | "format">[] };

/** 쿼터 설정: 시간·전술, 삭제 */
export function GameSettings({ matchId, game, tactics }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duration, setDuration] = useState(String(game.duration_min));

  function saveDuration() {
    const n = Number(duration);
    if (!n || n === game.duration_min) return;
    startTransition(async () => {
      const r = await updateGame(matchId, game.id, { duration_min: n });
      if ("error" in r) toast.error(r.error);
      else { toast.success("쿼터 시간을 저장했습니다"); router.refresh(); }
    });
  }

  function setTactic(id: string) {
    startTransition(async () => {
      const r = await updateGame(matchId, game.id, { tactic_id: id || null });
      if ("error" in r) toast.error(r.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Q${game.game_number} 쿼터를 삭제할까요? 득점·편성 기록도 함께 지워집니다.`)) return;
    startTransition(async () => {
      const r = await deleteGame(matchId, game.id);
      if ("error" in r) toast.error(r.error);
      else { toast.success("쿼터를 삭제했습니다"); router.push(`/matches/${matchId}?tab=games`); }
    });
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="g-dur" className="text-xs">쿼터 시간(분)</Label>
          <Input id="g-dur" inputMode="numeric" pattern="[0-9]*" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={saveDuration} disabled={pending} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="g-tactic" className="text-xs">사용 전술</Label>
          <NativeSelect id="g-tactic" value={game.tactic_id ?? ""} onChange={(e) => setTactic(e.target.value)} disabled={pending}>
            <option value="">없음</option>
            {tactics.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.format})</option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" className="text-destructive self-end" onClick={remove} disabled={pending}>
        <Trash2 /> 이 쿼터 삭제
      </Button>
    </div>
  );
}
