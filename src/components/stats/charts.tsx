"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatsData } from "@/lib/queries/stats";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } };

function Empty({ text }: { text: string }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{text}</p>;
}

/** 차트 탭: 월별 모임·참석, 상위 5명 득점 추이, 출전 vs 휴식 */
export function StatsCharts({ data }: { data: StatsData }) {
  const { months, scorerTrend, playTime } = data;
  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">월별 모임 수 · 평균 참석</CardTitle></CardHeader>
        <CardContent>
          {months.length === 0 ? <Empty text="끝난 모임이 없습니다." /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="matches" name="모임 수" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="avgAttendees" name="평균 참석" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">득점 상위 5명 월별 추이</CardTitle></CardHeader>
        <CardContent>
          {scorerTrend.points.length === 0 ? <Empty text="득점 기록이 없습니다." /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scorerTrend.points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {scorerTrend.names.map((n, i) => (
                    <Line key={n} type="monotone" dataKey={n} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle className="text-base">출전 쿼터 vs 휴식 쿼터 (공평하게 돌렸나)</CardTitle></CardHeader>
        <CardContent>
          {playTime.length === 0 ? <Empty text="출전 기록이 없습니다." /> : (
            <div style={{ height: Math.max(160, playTime.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playTime} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={56} tick={tick} tickLine={false} axisLine={false} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="played" name="출전" stackId="a" fill="var(--chart-1)" isAnimationActive={false} />
                  <Bar dataKey="rest" name="휴식" stackId="a" fill="var(--chart-3)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
