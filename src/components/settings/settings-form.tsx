"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { updateTeamSettings } from "@/app/actions/settings";
import type { MatchFormat, TeamSettingsRow } from "@/types/database";

export function SettingsForm({ s }: { s: TeamSettingsRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(s.team_name);
  const [format, setFormat] = useState<MatchFormat>(s.default_format);
  const [quarter, setQuarter] = useState(String(s.default_quarter_min));
  const [late, setLate] = useState(String(s.late_threshold_min));
  const [rating, setRating] = useState(s.rating_enabled);
  const [deadline, setDeadline] = useState(String(s.rating_deadline_hours));

  function save() {
    startTransition(async () => {
      const r = await updateTeamSettings({ team_name: name, default_format: format, default_quarter_min: Number(quarter), late_threshold_min: Number(late), rating_enabled: rating, rating_deadline_hours: Number(deadline) });
      if ("error" in r) toast.error(r.error);
      else { toast.success("설정을 저장했습니다"); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-col gap-2"><Label htmlFor="s-name">팀 이름</Label><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><Label htmlFor="s-format">기본 경기 형식</Label>
            <NativeSelect id="s-format" value={format} onChange={(e) => setFormat(e.target.value as MatchFormat)}><option value="6v6">6 대 6</option><option value="5v5">5 대 5</option></NativeSelect>
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="s-q">기본 쿼터 시간(분)</Label><Input id="s-q" inputMode="numeric" pattern="[0-9]*" value={quarter} onChange={(e) => setQuarter(e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>
        </div>
        <div className="flex flex-col gap-2"><Label htmlFor="s-late">지각 기준(분)</Label><Input id="s-late" inputMode="numeric" pattern="[0-9]*" value={late} onChange={(e) => setLate(e.target.value.replace(/\D/g, "").slice(0, 3))} /><p className="text-muted-foreground text-xs">출석 탭에서 &lsquo;지각&rsquo;을 누르면 이 값이 기본으로 들어갑니다.</p></div>
      </section>

      <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="s-rating">팀원 평점·MVP 투표 기능</Label>
            <p className="text-muted-foreground mt-1 text-xs">끄면 홈의 &lsquo;평점 남기기&rsquo; 카드와 입력 화면이 숨겨집니다. 대표 피드백·보고서는 그대로 동작합니다.</p>
          </div>
          <Switch id="s-rating" checked={rating} onCheckedChange={setRating} />
        </div>
        {rating && (
          <div className="flex flex-col gap-2"><Label htmlFor="s-dead">평점 입력 마감(경기 후 시간)</Label><Input id="s-dead" inputMode="numeric" pattern="[0-9]*" value={deadline} onChange={(e) => setDeadline(e.target.value.replace(/\D/g, "").slice(0, 3))} /></div>
        )}
      </section>

      <Button size="lg" className="h-14" onClick={save} disabled={pending || !name.trim()}><Save /> {pending ? "저장 중…" : "저장"}</Button>
    </div>
  );
}
