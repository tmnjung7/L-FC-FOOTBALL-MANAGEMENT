import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METRICS, type Metric } from "@/components/stats/ranking";
import { formatDateShort } from "@/lib/date";
import type { PeriodReportData } from "@/lib/report/period-text";

const MEDAL = ["🥇", "🥈", "🥉"];
const SHOW: Metric[] = ["goals", "assists", "points", "rating", "attendance", "gk", "late", "noshow"];

export function PeriodReportView({ d }: { d: PeriodReportData }) {
  const { stats: s, tops } = d;
  const ext = s.totals.externalWins + s.totals.externalDraws + s.totals.externalLosses;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-lg font-bold">{d.teamName} {d.period.label} 결산</p>
          {d.ai?.headline && <p className="text-primary text-base font-semibold">「{d.ai.headline}」</p>}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/60 rounded-lg p-2"><p className="text-muted-foreground text-xs">모임</p><p className="text-xl font-bold">{s.matchCount}</p></div>
            <div className="bg-muted/60 rounded-lg p-2"><p className="text-muted-foreground text-xs">쿼터</p><p className="text-xl font-bold">{s.totals.games}</p></div>
            <div className="bg-muted/60 rounded-lg p-2"><p className="text-muted-foreground text-xs">평균 참석</p><p className="text-xl font-bold">{s.totals.avgAttendees}</p></div>
          </div>
          {ext > 0 && (
            <p className="text-sm">상대팀 전적 <b>{s.totals.externalWins}승 {s.totals.externalDraws}무 {s.totals.externalLosses}패</b> · {s.totals.goalsFor}득점 {s.totals.goalsAgainst}실점{s.totals.internalMatches ? ` · 자체전 ${s.totals.internalMatches}회` : ""}</p>
          )}
        </CardContent>
      </Card>

      {(d.ai?.summary || d.narrative.length > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-2 text-sm leading-relaxed">
            <p className="whitespace-pre-line">{d.ai?.summary ?? d.narrative.join(" ")}</p>
            {d.ai?.highlights?.length ? <ul className="list-disc pl-5">{d.ai.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> : null}
            {d.ai?.nextFocus && <p className="text-muted-foreground"><b>다음 목표</b> · {d.ai.nextFocus}</p>}
          </CardContent>
        </Card>
      )}

      {s.opponents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">상대팀별 전적</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y text-sm">
              {s.opponents.map((o) => (
                <li key={o.opponent} className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium">{o.opponent} <span className="text-muted-foreground text-xs">{o.played}경기</span></span>
                  <span className="tabular-nums">{o.wins}승 {o.draws}무 {o.losses}패 <span className="text-muted-foreground text-xs">({o.gf}:{o.ga})</span></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">기간 랭킹 TOP3</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SHOW.map((m) => {
            const meta = METRICS.find((x) => x.key === m)!;
            const rows = tops[m];
            return (
              <div key={m} className="bg-muted/60 rounded-lg p-3">
                <p className="text-muted-foreground mb-1 text-xs font-semibold">{meta.label}{meta.desc ? ` · ${meta.desc}` : ""}</p>
                {rows.length === 0 ? <p className="text-muted-foreground text-sm">없음</p> : (
                  <ol className="space-y-0.5 text-sm">{rows.map((r) => <li key={r.name} className="flex justify-between"><span>{MEDAL[r.rank - 1] ?? r.rank} {r.name}</span><b className="tabular-nums">{m === "rating" ? r.value.toFixed(2) : m === "attendance" ? r.value.toFixed(0) : r.value}{meta.unit}</b></li>)}</ol>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {s.playTime.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">출전 쿼터 (공평도)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 text-sm">
            {s.playTime.map((p) => <span key={p.name} className="bg-muted rounded-md px-2 py-1">{p.name} <b>{p.played}</b><span className="text-muted-foreground text-xs">/휴식 {p.rest}</span></span>)}
          </CardContent>
        </Card>
      )}

      {s.matches.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">경기 목록</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y text-sm">
              {s.matches.map((m) => (
                <li key={m.match_id}>
                  <Link href={`/matches/${m.match_id}?tab=report`} className="hover:bg-accent flex items-center justify-between px-4 py-2">
                    <span>{formatDateShort(m.match_date)} <span className="text-muted-foreground text-xs">{m.venue ?? ""}</span></span>
                    <span className="flex items-center gap-2">
                      {m.opponent ? <><span className="text-muted-foreground max-w-24 truncate text-xs">vs {m.opponent}</span><Badge variant={m.team_a_goals > m.team_b_goals ? "success" : m.team_a_goals === m.team_b_goals ? "muted" : "destructive"}>{m.team_a_goals}:{m.team_b_goals}</Badge></> : <Badge variant="secondary">자체전</Badge>}
                      <span className="text-muted-foreground text-xs">{m.attendee_count}명</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
