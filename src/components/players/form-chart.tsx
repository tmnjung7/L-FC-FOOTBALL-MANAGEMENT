"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MatchForm } from "@/lib/queries/players";
import { formatDateShort } from "@/lib/date";

/** 최근 5경기 골/어시/평점 추이 미니 라인차트 */
export function FormChart({ form }: { form: MatchForm[] }) {
  const data = form.map((f) => ({
    name: formatDateShort(f.match_date).replace(/ \(.\)$/, ""),
    골: f.goals,
    도움: f.assists,
    평점: f.avg_rating,
  }));
  const hasRating = data.some((d) => d.평점 != null);

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          {hasRating && (
            <YAxis yAxisId="right" orientation="right" domain={[1, 10]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
          )}
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Line yAxisId="left" type="monotone" dataKey="골" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line yAxisId="left" type="monotone" dataKey="도움" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          {hasRating && (
            <Line yAxisId="right" type="monotone" dataKey="평점" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
