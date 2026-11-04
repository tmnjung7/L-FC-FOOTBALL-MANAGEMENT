"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteGoal } from "@/app/actions/events";
import type { EventEntry } from "@/lib/queries/games";

type Props = { matchId: string; gameId: string; events: EventEntry[]; canScore: boolean; labelA?: string; labelB?: string };

/** 한 쿼터의 득점 이벤트 목록 (+ 삭제) */
export function EventList({ matchId, gameId, events, canScore, labelA = "A", labelB = "B" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("이 득점 기록을 삭제할까요? 스코어도 함께 줄어듭니다.")) return;
    startTransition(async () => {
      const r = await deleteGoal(matchId, gameId, id);
      if ("error" in r) toast.error(r.error);
      else router.refresh();
    });
  }

  if (events.length === 0) return <p className="text-muted-foreground px-1 py-2 text-sm">득점 없음</p>;
  return (
    <ul className="divide-y">
      {events.map((e) => (
        <li key={e.id} className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
          <Badge variant={e.team === "A" ? "teamA" : "teamB"} className="h-5 max-w-20 justify-center truncate px-1.5">{e.team === "A" ? labelA : labelB}</Badge>
          <span className="text-muted-foreground w-9 shrink-0 text-xs tabular-nums">{e.minute != null ? `${e.minute}'` : ""}</span>
          <span className="min-w-0 flex-1 truncate">
            <b>{e.scorer_id ? e.scorer_name : "실점"}</b>
            {e.is_own_goal && <span className="text-destructive ml-1 text-xs">(자책골)</span>}
            {e.assist_name && <span className="text-muted-foreground ml-1 text-xs">· 도움 {e.assist_name}</span>}
          </span>
          {canScore && (
            <Button variant="ghost" size="icon" className="text-muted-foreground size-9" aria-label="삭제" disabled={pending} onClick={() => remove(e.id)}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
