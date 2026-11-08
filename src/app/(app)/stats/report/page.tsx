import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/stats/period-filter";
import { PeriodReportView } from "@/components/report/period-report-view";
import { PeriodReportShare } from "@/components/report/period-report-share";
import { PeriodReportImage } from "@/components/report/period-report-image";
import { getViewer } from "@/lib/auth";
import { resolvePeriod } from "@/lib/queries/stats";
import { buildPeriodReport } from "@/lib/report/period";

export const metadata: Metadata = { title: "결산 리포트" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string }> };

export default async function PeriodReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const period = resolvePeriod(sp.period ?? "month", sp.from, sp.to);
  const [viewer, data] = await Promise.all([getViewer(), buildPeriodReport(period)]);
  return (
    <>
      <PageHeader title="결산 리포트" description={period.label} action={<Button asChild variant="ghost" size="icon" aria-label="통계로"><Link href="/stats"><ArrowLeft className="size-5" /></Link></Button>} />
      <div className="flex flex-col gap-3 py-3">
        <PeriodFilter period={period} basePath="/stats/report" />
        <PeriodReportShare d={data} isAdmin={viewer.isAdmin} periodKey={period.key} from={sp.from} to={sp.to} />
        <PeriodReportView d={data} />
        <PeriodReportImage d={data} />
      </div>
    </>
  );
}
