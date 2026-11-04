import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/home/setup-notice";
import { PeriodFilter } from "@/components/stats/period-filter";
import { METRICS, Ranking, type Metric } from "@/components/stats/ranking";
import { StatsTable } from "@/components/stats/stats-table";
import { StatsCharts } from "@/components/stats/charts";
import { ShareImageButton } from "@/components/stats/share-button";
import { isSupabaseConfigured } from "@/lib/env";
import { getTeamSettings } from "@/lib/queries/home";
import { getStats, resolvePeriod } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "통계" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; tab?: string; metric?: string }> };
const TABS = [
  { key: "rank", label: "랭킹" },
  { key: "table", label: "표" },
  { key: "chart", label: "차트" },
] as const;

export default async function StatsPage({ searchParams }: Props) {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="통계" />
        <div className="mt-4"><SetupNotice /></div>
      </>
    );
  }
  const sp = await searchParams;
  const period = resolvePeriod(sp.period, sp.from, sp.to);
  const tab = sp.tab === "table" || sp.tab === "chart" ? sp.tab : "rank";
  const metric: Metric = METRICS.some((m) => m.key === sp.metric) ? (sp.metric as Metric) : "goals";
  const [data, settings] = await Promise.all([getStats(period), getTeamSettings()]);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ period: period.key, ...(period.from && period.key === "custom" ? { from: period.from } : {}), ...(period.to && period.key === "custom" ? { to: period.to } : {}), tab, metric, ...patch });
    return `/stats?${p.toString()}`;
  };
  const title = `${settings?.team_name ?? "L-FC"} ${period.label} ${METRICS.find((m) => m.key === metric)?.label} 랭킹`;

  return (
    <>
      <PageHeader title="통계" description={`${period.label} · 완료 모임 ${data.matchCount}회`} action={tab === "rank" ? <ShareImageButton targetId="ranking-share" fileName={title} /> : undefined} />
      <div className="flex flex-col gap-3 py-3">
        <PeriodFilter period={period} />
        <nav className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1" aria-label="통계 보기">
          {TABS.map((t) => (
            <Link key={t.key} href={qs({ tab: t.key })} scroll={false} aria-current={tab === t.key ? "page" : undefined} className={cn("flex h-10 items-center justify-center rounded-md text-sm font-medium", tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "rank" && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {METRICS.map((m) => (
                <Link key={m.key} href={qs({ metric: m.key })} scroll={false} aria-current={metric === m.key ? "page" : undefined} className={cn("h-9 shrink-0 rounded-full px-3 text-xs font-medium leading-9", metric === m.key ? "bg-foreground text-background" : "bg-muted hover:bg-accent")}>
                  {m.label}
                </Link>
              ))}
            </div>
            <Ranking rows={data.players} metric={metric} id="ranking-share" title={title} />
            {data.matchCount === 0 && <p className="text-muted-foreground text-center text-xs">통계는 &lsquo;모임 종료(완료 처리)&rsquo;한 모임만 집계합니다.</p>}
          </>
        )}
        {tab === "table" && <StatsTable rows={data.players} />}
        {tab === "chart" && <StatsCharts data={data} />}
      </div>
    </>
  );
}
