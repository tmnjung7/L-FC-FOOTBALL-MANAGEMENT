import { RsvpButtons } from "@/components/home/rsvp-buttons";
import { Card, CardContent } from "@/components/ui/card";
import { ATTENDANCE_LABEL, type AttendanceRow, type AttendanceStatus, type MatchRow, type PlayerRow } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { match: MatchRow; players: PlayerRow[]; attendance: AttendanceRow[]; myPlayerId: string | null };

const ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const DOT: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  excused: "bg-neutral-400",
};

/** 출석 탭 조회 화면 (팀원용). 예정 모임이면 내 참석/불참 버튼 */
export function AttendanceView({ match, players, attendance, myPlayerId }: Props) {
  const byId = new Map(attendance.map((a) => [a.player_id, a]));
  const mine = myPlayerId ? (byId.get(myPlayerId)?.status ?? null) : null;
  const isUpcoming = match.status === "scheduled";
  const groups = ORDER.map((s) => ({ s, list: players.filter((p) => byId.get(p.id)?.status === s) }));
  const none = players.filter((p) => !byId.has(p.id) && p.is_active);

  return (
    <div className="flex flex-col gap-3">
      {isUpcoming && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">내 참석 응답</p>
            {myPlayerId ? <RsvpButtons matchId={match.id} mine={mine} /> : <p className="text-muted-foreground text-xs">홈에서 내 이름을 먼저 골라 주세요.</p>}
          </CardContent>
        </Card>
      )}
      {groups.map(({ s, list }) =>
        list.length === 0 ? null : (
          <section key={s} className="bg-card rounded-xl border px-4 py-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className={cn("size-2.5 rounded-full", DOT[s])} />
              {isUpcoming && s === "present" ? "참석 예정" : isUpcoming && s === "excused" ? "불참" : ATTENDANCE_LABEL[s]} {list.length}명
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {list.map((p) => {
                const a = byId.get(p.id)!;
                return (
                  <li key={p.id} className={cn("bg-muted rounded-md px-2 py-1 text-sm", p.id === myPlayerId && "ring-primary ring-2")}>
                    {p.name}
                    {s === "late" && a.late_minutes != null && <span className="text-muted-foreground ml-1 text-xs">{a.late_minutes}분</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
      {none.length > 0 && (
        <section className="bg-card rounded-xl border px-4 py-3 shadow-sm">
          <h3 className="text-muted-foreground mb-2 text-sm font-semibold">{isUpcoming ? "미응답" : "미입력"} {none.length}명</h3>
          <ul className="flex flex-wrap gap-1.5">
            {none.map((p) => (
              <li key={p.id} className="text-muted-foreground rounded-md border px-2 py-1 text-sm">{p.name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
