import Link from "next/link";
import { Crown, Star, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Leader, MonthLeaders as MonthLeadersData } from "@/lib/queries/home";

function LeaderTile({ title, icon, leader, unit }: { title: string; icon: React.ReactNode; leader: Leader | null; unit: string }) {
  return (
    <div className="bg-muted/60 flex min-w-0 flex-col gap-1 rounded-lg p-3">
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {title}
      </div>
      {leader ? (
        <>
          <p className="truncate text-base font-bold">{leader.name}</p>
          <p className="text-primary text-sm font-semibold">
            {leader.value}
            {unit}
            {leader.sub && <span className="text-muted-foreground ml-1 text-xs font-normal">{leader.sub}</span>}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">기록 없음</p>
      )}
    </div>
  );
}

export function MonthLeaders({ data }: { data: MonthLeadersData }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Crown className="size-4 text-amber-500" />
          {data.label} 랭킹
        </CardTitle>
        <Link href="/stats" className="text-muted-foreground text-sm">통계 →</Link>
      </CardHeader>
      <CardContent>
        {!data.hasData ? (
          <p className="text-muted-foreground text-sm">이번 달 기록이 아직 없습니다.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <LeaderTile title="득점왕" icon={<Target className="size-3.5" />} leader={data.goals} unit="골" />
            <LeaderTile title="어시왕" icon={<Zap className="size-3.5" />} leader={data.assists} unit="도움" />
            <LeaderTile title="평점왕" icon={<Star className="size-3.5" />} leader={data.rating} unit="점" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
