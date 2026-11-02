import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerFormDrawer } from "@/components/players/player-form-drawer";
import { FormChart } from "@/components/players/form-chart";
import { getViewer } from "@/lib/auth";
import { formatDate, formatDateShort } from "@/lib/date";
import { getPlayerDetail } from "@/lib/queries/players";
import { POSITION_LABEL, type PositionType } from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPlayerDetail(id);
  return { title: detail?.player.name ?? "선수" };
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-muted/60 rounded-lg p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  );
}

const RESULT_LABEL = { W: "승", D: "무", L: "패" } as const;
const RESULT_CLASS = {
  W: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  D: "bg-muted text-muted-foreground",
  L: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
} as const;

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params;
  const [viewer, detail] = await Promise.all([getViewer(), getPlayerDetail(id)]);
  if (!detail) notFound();
  const { player, stats, form, games } = detail;

  const positions = stats
    ? (Object.entries(stats.positions_played ?? {}) as [PositionType, number][]).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <>
      <PageHeader
        title={player.name}
        description={`${POSITION_LABEL[player.preferred_position]}${player.jersey_number != null ? ` · #${player.jersey_number}` : ""}${player.is_active ? "" : " · 비활성"}`}
        action={
          <div className="flex items-center gap-1">
            {viewer.isAdmin && (
              <PlayerFormDrawer
                player={player}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil /> 수정
                  </Button>
                }
              />
            )}
            <Button asChild variant="ghost" size="icon" aria-label="선수 목록으로">
              <Link href="/players"><ArrowLeft className="size-5" /></Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 py-4">
        {/* 시즌 요약 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">시즌 요약</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats || stats.matches_played === 0 ? (
              <p className="text-muted-foreground text-sm">아직 출전 기록이 없습니다.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="참석 모임" value={stats.matches_played} sub={`출석률 ${stats.attendance_rate ?? "-"}%`} />
                  <Stat label="출전 쿼터" value={stats.quarters_played} sub={`휴식 ${stats.rest_quarters}`} />
                  <Stat label="승/무/패" value={`${stats.wins}/${stats.draws}/${stats.losses}`} />
                  <Stat label="골" value={stats.goals} sub={stats.own_goals ? `자책 ${stats.own_goals}` : undefined} />
                  <Stat label="도움" value={stats.assists} />
                  <Stat label="평점" value={stats.avg_rating != null ? Number(stats.avg_rating).toFixed(2) : "-"} sub={stats.rating_count ? `${stats.rating_count}건` : "평가 없음"} />
                  <Stat label="지각" value={stats.late_count} />
                  <Stat label="결석" value={stats.absent_count} sub={[stats.excused_count ? `사전통보 ${stats.excused_count}` : null, stats.no_show_count ? `노쇼 ${stats.no_show_count}` : null].filter(Boolean).join(" · ") || undefined} />
                  <Stat label="주 포지션" value={stats.main_position ? POSITION_LABEL[stats.main_position].split("(")[0] : "-"} />
                </div>
                {positions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {positions.map(([pos, n]) => (
                      <Badge key={pos} variant="secondary">
                        {pos} {n}쿼터
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 최근 5경기 폼 */}
        {form.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 {form.length}경기 폼</CardTitle>
            </CardHeader>
            <CardContent>
              <FormChart form={form} />
            </CardContent>
          </Card>
        )}

        {/* 게임별 기록 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">쿼터별 기록</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {games.length === 0 ? (
              <p className="text-muted-foreground px-4 pb-2 text-sm">출전한 쿼터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground bg-muted/50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">날짜</th>
                      <th className="px-2 py-2 text-center font-medium">Q</th>
                      <th className="px-2 py-2 text-center font-medium">팀</th>
                      <th className="px-2 py-2 text-center font-medium">스코어</th>
                      <th className="px-2 py-2 text-center font-medium">결과</th>
                      <th className="px-2 py-2 text-center font-medium">골</th>
                      <th className="px-2 py-2 text-center font-medium">도움</th>
                      <th className="px-3 py-2 text-center font-medium">포지션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {games.slice(0, 60).map((g) => (
                      <tr key={g.game_id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link href={`/matches/${g.match_id}`} className="underline-offset-4 hover:underline" title={formatDate(g.match_date)}>
                            {formatDateShort(g.match_date).replace(/ \(.\)$/, "")}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-center">Q{g.game_number}</td>
                        <td className="px-2 py-2 text-center">
                          <Badge variant={g.team === "A" ? "teamA" : "teamB"} className="h-5 px-1.5">{g.team}</Badge>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums whitespace-nowrap">{g.team_a_score} : {g.team_b_score}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-semibold", RESULT_CLASS[g.result])}>{RESULT_LABEL[g.result]}</span>
                        </td>
                        <td className={cn("px-2 py-2 text-center tabular-nums", g.goals > 0 && "font-bold")}>{g.goals || ""}</td>
                        <td className={cn("px-2 py-2 text-center tabular-nums", g.assists > 0 && "font-bold")}>{g.assists || ""}</td>
                        <td className="text-muted-foreground px-3 py-2 text-center text-xs">{g.position ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {games.length > 60 && <p className="text-muted-foreground px-4 py-2 text-xs">최근 60쿼터만 표시</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
