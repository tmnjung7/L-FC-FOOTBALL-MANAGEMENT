"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveAdminFeedback } from "@/app/actions/admin-feedback";
import { cn } from "@/lib/utils";

export type FeedbackTarget = { id: string; name: string; note: string; goals: number; assists: number; quarters: number; gk: number; late: boolean };
type Props = { matchId: string; targets: FeedbackTarget[]; initialMvp: string | null; initialMemo: string };

/** 대표가 빠르게 누르는 키워드. 순서 = 자주 쓰는 순 */
const KEYWORDS = ["활약", "득점력", "패스", "수비", "체력", "골키퍼", "집중력", "팀워크", "리더십", "위치선정", "분발필요", "지각", "부상"];

function split(note: string): string[] {
  return note.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 경기 피드백 작성 (관리자 전용).
 * 참석자마다 키워드 토글 + 짧은 메모, MVP 지정, 총평 → 저장하면 보고서에 반영된다.
 */
export function AdminFeedbackForm({ matchId, targets, initialMvp, initialMemo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>(Object.fromEntries(targets.map((t) => [t.id, t.note])));
  const [mvp, setMvp] = useState<string | null>(initialMvp);
  const [memo, setMemo] = useState(initialMemo);

  function toggleKeyword(id: string, k: string) {
    setNotes((prev) => {
      const parts = split(prev[id] ?? "");
      const next = parts.includes(k) ? parts.filter((p) => p !== k) : [...parts, k];
      return { ...prev, [id]: next.join(", ") };
    });
  }

  function save() {
    startTransition(async () => {
      const r = await saveAdminFeedback(matchId, {
        notes: targets.map((t) => ({ player_id: t.id, note: notes[t.id] ?? "" })),
        mvp_player_id: mvp,
        memo: memo || null,
      });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("피드백을 저장했습니다. 보고서에 반영됩니다.");
      router.push(`/matches/${matchId}?tab=report`);
      router.refresh();
    });
  }

  const filled = targets.filter((t) => (notes[t.id] ?? "").trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-xl border p-3 shadow-sm">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Trophy className="size-4 text-amber-500" /> 오늘의 MVP</h3>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <button key={t.id} type="button" onClick={() => setMvp(mvp === t.id ? null : t.id)} aria-pressed={mvp === t.id}
              className={cn("h-11 rounded-full border px-4 text-sm font-medium", mvp === t.id ? "border-amber-500 bg-amber-400 text-black" : "bg-card hover:bg-accent")}>
              {mvp === t.id ? "🏆 " : ""}{t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-semibold">참석자별 피드백 <span className="text-muted-foreground font-normal">{filled}/{targets.length}</span></h3>
        {targets.map((t) => {
          const parts = split(notes[t.id] ?? "");
          return (
            <div key={t.id} className="bg-card rounded-xl border p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{t.name}{mvp === t.id && " 🏆"}</p>
                <p className="text-muted-foreground text-xs">{t.quarters}Q · {t.goals}골 {t.assists}도움{t.gk ? ` · GK ${t.gk}Q` : ""}{t.late ? " · 지각" : ""}</p>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {KEYWORDS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleKeyword(t.id, k)} aria-pressed={parts.includes(k)}
                    className={cn("h-9 rounded-full px-3 text-xs font-medium transition-colors", parts.includes(k) ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>
                    {k}
                  </button>
                ))}
              </div>
              <Input value={notes[t.id] ?? ""} onChange={(e) => setNotes((p) => ({ ...p, [t.id]: e.target.value.slice(0, 200) }))} placeholder="키워드를 누르거나 직접 입력 (쉼표로 구분)" className="h-10 text-sm" />
            </div>
          );
        })}
      </section>

      <section className="bg-card rounded-xl border p-3 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">경기 총평 <span className="text-muted-foreground font-normal">(선택, 500자)</span></h3>
        <Textarea value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 500))} placeholder="예: 전반 압박이 좋았고 후반 체력 저하. 다음 주는 세트피스 연습." className="min-h-24" />
      </section>

      <div className="bg-background/95 sticky z-10 py-2 backdrop-blur" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <Button size="lg" className="h-14 w-full text-base" onClick={save} disabled={pending}><Save /> {pending ? "저장 중…" : "저장하고 보고서 보기"}</Button>
      </div>
    </div>
  );
}
