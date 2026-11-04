import type { PlayerSeasonStatsRow } from "@/types/database";
import { cn } from "@/lib/utils";

export type Metric = "goals" | "assists" | "points" | "rating" | "attendance" | "late" | "noshow" | "gk";

export const METRICS: { key: Metric; label: string; unit: string; desc?: string }[] = [
  { key: "goals", label: "득점", unit: "골" },
  { key: "assists", label: "도움", unit: "개" },
  { key: "points", label: "공격포인트", unit: "P", desc: "골 + 도움" },
  { key: "rating", label: "평점", unit: "점", desc: "평가 3건 이상" },
  { key: "attendance", label: "출석률", unit: "%", desc: "사전통보 제외" },
  { key: "late", label: "지각", unit: "회" },
  { key: "noshow", label: "노쇼", unit: "회", desc: "투표 참석 후 결석" },
  { key: "gk", label: "골키퍼", unit: "쿼터", desc: "GK 로 뛴 쿼터 수" },
];

export function metricValue(r: PlayerSeasonStatsRow, m: Metric): number | null {
  switch (m) {
    case "goals": return r.goals;
    case "assists": return r.assists;
    case "points": return r.goals + r.assists;
    case "rating": return r.avg_rating != null && r.rating_count >= 3 ? Number(r.avg_rating) : null;
    case "attendance": return r.attendance_rate != null ? Number(r.attendance_rate) : null;
    case "late": return r.late_count;
    case "noshow": return r.no_show_count;
    case "gk": return r.positions_played?.GK ?? 0;
  }
}

export function rankPlayers(rows: PlayerSeasonStatsRow[], m: Metric): { r: PlayerSeasonStatsRow; v: number; rank: number }[] {
  const list = rows
    .map((r) => ({ r, v: metricValue(r, m) }))
    .filter((x): x is { r: PlayerSeasonStatsRow; v: number } => x.v != null && (m === "late" || m === "noshow" || m === "gk" ? x.v > 0 : x.v > 0 || m === "attendance"))
    .sort((a, b) => b.v - a.v || b.r.matches_played - a.r.matches_played || a.r.name.localeCompare(b.r.name));
  // 동점은 같은 순위
  let rank = 0, prev: number | null = null;
  return list.map((x, i) => {
    if (prev === null || x.v !== prev) rank = i + 1;
    prev = x.v;
    return { ...x, rank };
  });
}

const MEDAL = ["🥇", "🥈", "🥉"];

function sub(r: PlayerSeasonStatsRow, m: Metric): string {
  switch (m) {
    case "goals": case "assists": case "points": return `${r.matches_played}회 참석 · ${r.quarters_played}쿼터`;
    case "rating": return `${r.rating_count}건 평가`;
    case "attendance": return `출석 ${r.present_count + r.late_count} · 결석 ${r.absent_count}`;
    case "late": return `${r.matches_played}회 중`;
    case "noshow": return `투표 후 불참`;
    case "gk": return `출전 ${r.quarters_played}쿼터 중`;
  }
}

/** 랭킹 목록 (1~3위 메달). 이미지 공유용으로 id 를 받는다 */
export function Ranking({ rows, metric, id, title }: { rows: PlayerSeasonStatsRow[]; metric: Metric; id?: string; title?: string }) {
  const ranked = rankPlayers(rows, metric);
  const meta = METRICS.find((x) => x.key === metric)!;
  return (
    <div id={id} className="bg-card rounded-xl border p-3 shadow-sm">
      {title && <p className="mb-2 text-center text-base font-bold">{title}</p>}
      <p className="text-muted-foreground mb-2 text-xs">{meta.label} 랭킹{meta.desc ? ` · ${meta.desc}` : ""}</p>
      {ranked.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">이 기간 기록이 없습니다.</p>
      ) : (
        <ol className="divide-y">
          {ranked.map(({ r, v, rank }) => (
            <li key={r.player_id} className={cn("flex min-h-12 items-center gap-3 py-1.5", rank <= 3 && "font-semibold")}>
              <span className={cn("w-8 shrink-0 text-center text-lg", rank > 3 && "text-muted-foreground text-sm")}>{rank <= 3 ? MEDAL[rank - 1] : rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.name}</span>
                <span className="text-muted-foreground block text-xs font-normal">{sub(r, metric)}</span>
              </span>
              <span className="text-primary shrink-0 text-lg tabular-nums">
                {metric === "rating" ? v.toFixed(2) : metric === "attendance" ? v.toFixed(0) : v}
                <span className="text-muted-foreground ml-0.5 text-xs">{meta.unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
