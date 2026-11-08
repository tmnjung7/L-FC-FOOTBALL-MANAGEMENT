import Link from "next/link";
import { PencilLine, Star } from "lucide-react";
import { AiReportButton } from "@/components/report/ai-report-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportData } from "@/lib/report/build";

const MEDAL = ["🥇", "🥈", "🥉"];

function Top3({ title, rows, unit, fmt }: { title: string; rows: ReportData["topScorers"]; unit: string; fmt?: (v: number) => string }) {
  return (
    <div className="bg-muted/60 rounded-lg p-3">
      <p className="text-muted-foreground mb-1 text-xs font-semibold">{title}</p>
      {rows.length === 0 ? <p className="text-muted-foreground text-sm">기록 없음</p> : (
        <ol className="space-y-0.5 text-sm">
          {rows.map((r, i) => (
            <li key={r.player_id} className="flex justify-between">
              <span>{MEDAL[i]} {r.name}</span>
              <span className="font-semibold tabular-nums">{fmt ? fmt(r.value) : r.value}{unit}{r.count != null ? <span className="text-muted-foreground ml-1 text-xs font-normal">({r.count}명)</span> : null}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** 보고서 탭 화면 (카드형). 데이터는 항상 최신 기준으로 자동 생성 */
export function ReportView({ d, showRateLink, isAdmin = false }: { d: ReportData; showRateLink: boolean; isAdmin?: boolean }) {
  const result = d.opponent ? (d.totalA > d.totalB ? "승" : d.totalA === d.totalB ? "무" : "패") : null;
  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold">{d.dateLabel}</p>
            <Badge variant={d.opponent ? "teamB" : "secondary"}>{d.opponent ? `vs ${d.opponent}` : "자체전"}</Badge>
            <Badge variant="outline">{d.format}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{d.venue ?? "장소 미정"}{d.timeLabel ? ` · ${d.timeLabel}` : ""} · 참석 {d.attendeeCount}명{d.lateCount ? ` (지각 ${d.lateCount})` : ""}</p>
          {d.quarters.length > 0 && (
            <p className="text-3xl font-black tabular-nums">
              <span className="text-team-a">{d.totalA}</span> : <span className="text-team-b">{d.totalB}</span>
              <span className="ml-2 text-base font-semibold">{result ?? `A ${d.winsA}승 ${d.draws}무 ${d.lossesA}패`}</span>
            </p>
          )}
          {d.status !== "done" && <p className="text-amber-600 text-xs">아직 &lsquo;완료&rsquo; 처리되지 않은 모임입니다. 완료 처리 후 팀원이 평점을 남길 수 있습니다.</p>}
        </CardContent>
      </Card>

      {/* 대표 피드백 작성 안내 (admin) */}
      {isAdmin && d.status === "done" && (
        <Card className={d.playerLines.some((p) => p.note) || d.memo ? undefined : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"}>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm">
              {d.playerLines.some((p) => p.note) || d.memo ? "참석자별 피드백·MVP·총평이 보고서에 반영되어 있습니다." : "참석자별 키워드·MVP·총평을 적으면 보고서 문장이 채워집니다."}
            </p>
            <Button asChild size="sm"><Link href={`/matches/${d.matchId}/feedback`}><PencilLine /> 피드백 작성</Link></Button>
          </CardContent>
        </Card>
      )}

      {/* AI 다듬기 (admin) */}
      {isAdmin && d.status === "done" && <AiReportButton matchId={d.matchId} configured={d.aiConfigured} hasAi={!!d.ai} generatedAt={d.ai?.generated_at ?? null} />}

      {/* 요약 문단: AI 가 쓴 글이 있으면 그것을, 없으면 템플릿 문장 */}
      {d.ai ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-2">
            <p className="text-lg font-bold">「{d.ai.headline}」</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{d.ai.summary}</p>
            {d.ai.nextFocus && <p className="text-muted-foreground text-sm"><b>다음 경기 포인트</b> · {d.ai.nextFocus}</p>}
          </CardContent>
        </Card>
      ) : d.narrative.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="text-sm leading-relaxed">{d.narrative.join(" ")}</CardContent>
        </Card>
      ) : null}

      {/* 쿼터별 스코어 */}
      {d.quarters.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">쿼터별 스코어</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="text-muted-foreground text-xs"><th className="pr-3 text-left">팀</th>{d.quarters.map((q) => <th key={q.n} className="px-2 text-center">Q{q.n}</th>)}<th className="pl-3 text-center">합</th></tr></thead>
              <tbody>
                <tr><td className="text-team-a pr-3 font-semibold">{d.opponent ? "우리" : "A"}</td>{d.quarters.map((q) => <td key={q.n} className={`px-2 text-center tabular-nums ${q.a > q.b ? "font-bold" : ""}`}>{q.a}</td>)}<td className="pl-3 text-center font-bold tabular-nums">{d.totalA}</td></tr>
                <tr><td className="text-team-b pr-3 font-semibold">{d.opponent ?? "B"}</td>{d.quarters.map((q) => <td key={q.n} className={`px-2 text-center tabular-nums ${q.b > q.a ? "font-bold" : ""}`}>{q.b}</td>)}<td className="pl-3 text-center font-bold tabular-nums">{d.totalB}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TOP3 + MVP */}
      <Card>
        <CardHeader><CardTitle className="text-base">오늘의 기록</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Top3 title="득점" rows={d.topScorers} unit="골" />
          <Top3 title="도움" rows={d.topAssists} unit="개" />
          <Top3 title={`평점 (${d.raterCount}명 평가)`} rows={d.topRated} unit="점" fmt={(v) => v.toFixed(1)} />
        </CardContent>
      </Card>

      <Card className={d.mvp ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : undefined}>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-semibold">🏆 MVP</p>
            {d.mvp ? <p className="text-xl font-bold">{d.mvp.name} <span className="text-muted-foreground text-sm font-normal">{d.mvp.byAdmin ? "대표 선정" : `${d.mvp.votes}표`}</span></p> : <p className="text-muted-foreground text-sm">아직 없음</p>}
            {d.mvpVotes.length > 0 && <p className="text-muted-foreground text-xs">팀원 투표: {d.mvpVotes.slice(0, 4).map((v) => `${v.name} ${v.votes}`).join(" · ")}</p>}
          </div>
          {showRateLink && (
            <Button asChild size="sm"><Link href={`/matches/${d.matchId}/rate`}><Star /> 평점·MVP 입력</Link></Button>
          )}
        </CardContent>
      </Card>

      {/* 출전 분포 */}
      {d.playTime.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">출전 쿼터</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 text-sm">
            {d.playTime.map((p) => <span key={p.name} className="bg-muted rounded-md px-2 py-1">{p.name} <b>{p.quarters}</b></span>)}
          </CardContent>
        </Card>
      )}

      {/* 선수별 코멘트 (대표 키워드 + 기록) */}
      <Card>
        <CardHeader><CardTitle className="text-base">선수별 코멘트</CardTitle></CardHeader>
        <CardContent>
          {d.playerLines.length === 0 ? <p className="text-muted-foreground text-sm">출석 체크된 참석자가 없습니다.</p> : (
            <ul className="divide-y text-sm">
              {d.playerLines.map((p) => {
                const aiComment = d.ai?.playerComments.find((c) => c.name === p.name)?.comment;
                return (
                  <li key={p.name} className="flex flex-col py-1.5">
                    <span className="flex items-center justify-between">
                      <b>{p.isMvp ? "🏆 " : ""}{p.name}</b>
                      <span className="text-muted-foreground text-xs">{p.stats}</span>
                    </span>
                    {aiComment ? (
                      <span className="text-sm leading-snug">{aiComment}</span>
                    ) : p.note ? (
                      <span className="text-primary text-sm">{p.note}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{isAdmin ? "피드백 미입력" : ""}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 피드백 */}
      {(d.comments.length > 0 || showRateLink) && (
      <Card>
        <CardHeader><CardTitle className="text-base">팀원 피드백 <span className="text-muted-foreground text-xs font-normal">{d.feedbackCount}명 참여</span></CardTitle></CardHeader>
        <CardContent>
          {d.comments.length === 0 ? <p className="text-muted-foreground text-sm">아직 없음</p> : (
            <ul className="space-y-1.5 text-sm">{d.comments.map((c, i) => <li key={i}><b>{c.name}</b> <span className="text-muted-foreground">· {c.comment}</span></li>)}</ul>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
