"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/app/actions/feedback";
import { cn } from "@/lib/utils";

type Target = { id: string; name: string };
type Props = {
  matchId: string;
  targets: Target[]; // 나를 제외한 참석자
  initialRatings: Record<string, number>;
  initialComment: string;
  initialMvp: string | null;
  ratingEnabled: boolean;
  readOnly?: boolean;
};

const DEFAULT = 7;

/** 평점(±0.5) → 한 줄 피드백 → MVP 한 번에. 1분 안에 끝나게 */
export function RatingForm({ matchId, targets, initialRatings, initialComment, initialMvp, ratingEnabled, readOnly = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const [comment, setComment] = useState(initialComment);
  const [mvp, setMvp] = useState<string | null>(initialMvp);

  function adjust(id: string, delta: number) {
    setRatings((prev) => {
      const cur = prev[id];
      const next = cur == null ? DEFAULT : Math.min(10, Math.max(1, Math.round((cur + delta) * 2) / 2));
      return { ...prev, [id]: next };
    });
  }
  function clear(id: string) {
    setRatings((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }
  function rateAll(v: number) {
    setRatings((prev) => { const n = { ...prev }; for (const t of targets) if (n[t.id] == null) n[t.id] = v; return n; });
  }

  function save() {
    startTransition(async () => {
      const r = await submitFeedback(matchId, {
        ratings: Object.entries(ratings).map(([player_id, score]) => ({ player_id, score })),
        comment: comment || null,
        mvp_vote_id: mvp,
      });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("저장했습니다. 고마워요!");
      router.push(`/matches/${matchId}?tab=report`);
      router.refresh();
    });
  }

  const rated = Object.keys(ratings).length;

  return (
    <div className="flex flex-col gap-4">
      {ratingEnabled && (
        <section className="bg-card rounded-xl border p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Star className="size-4 text-amber-500" /> 평점 <span className="text-muted-foreground font-normal">{rated}/{targets.length}</span></h3>
            {!readOnly && rated < targets.length && (
              <button type="button" onClick={() => rateAll(DEFAULT)} className="text-primary text-xs underline-offset-4 hover:underline">미입력 전원 {DEFAULT}점으로</button>
            )}
          </div>
          <ul className="divide-y">
            {targets.map((t) => {
              const v = ratings[t.id];
              return (
                <li key={t.id} className="flex min-h-12 items-center gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                  {!readOnly && (
                    <Button type="button" variant="outline" size="icon" className="size-10" aria-label="0.5 내리기" onClick={() => adjust(t.id, -0.5)}><Minus /></Button>
                  )}
                  <button type="button" onClick={() => (!readOnly && v != null ? clear(t.id) : undefined)} className={cn("w-14 text-center text-lg font-bold tabular-nums", v == null ? "text-muted-foreground text-sm font-normal" : v >= 8 ? "text-primary" : "")} title={v != null ? "탭하면 비움" : ""}>
                    {v == null ? "—" : v.toFixed(1)}
                  </button>
                  {!readOnly && (
                    <Button type="button" variant="outline" size="icon" className="size-10" aria-label="0.5 올리기" onClick={() => adjust(t.id, +0.5)}><Plus /></Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-1 text-xs">1.0~10.0, 0.5 단위. 비워 두면 평가 안 함. 숫자를 탭하면 비워집니다.</p>
        </section>
      )}

      <section className="bg-card rounded-xl border p-3 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">💬 한 줄 피드백 <span className="text-muted-foreground font-normal">(선택, 200자)</span></h3>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 200))} placeholder="예: 후반 체력 떨어짐. 코너킥 패턴 하나 만들자" disabled={readOnly} />
        <p className="text-muted-foreground mt-1 text-right text-xs">{comment.length}/200</p>
      </section>

      <section className="bg-card rounded-xl border p-3 shadow-sm">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Trophy className="size-4 text-amber-500" /> 오늘의 MVP <span className="text-muted-foreground font-normal">(1명)</span></h3>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={readOnly}
              onClick={() => setMvp(mvp === t.id ? null : t.id)}
              aria-pressed={mvp === t.id}
              className={cn("h-11 rounded-full border px-4 text-sm font-medium transition-colors", mvp === t.id ? "border-amber-500 bg-amber-400 text-black" : "bg-card hover:bg-accent")}
            >
              {mvp === t.id ? "🏆 " : ""}{t.name}
            </button>
          ))}
        </div>
      </section>

      {!readOnly && (
        <Button size="lg" className="h-14 text-base" onClick={save} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      )}
    </div>
  );
}
