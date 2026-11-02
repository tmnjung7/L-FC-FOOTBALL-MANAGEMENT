import { RsvpButtons } from "@/components/home/rsvp-buttons";
import { Card, CardContent } from "@/components/ui/card";
import { ATTENDANCE_LABEL, type AttendanceRow, type AttendanceStatus, type MatchRow, type PlayerRow } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { match: MatchRow; players: PlayerRow[]; attendance: AttendanceRow[]; myPlayerId: string | null };

const ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const DOT: Record<AttendanceStatus, string> = { present: "bg-emerald-500", late: "bg-amber-500", absent: "bg-red-500", excused: "bg-neutral-400" };

function Group({ title, dot, list, byId, myPlayerId, showLate }: { title: string; dot: string; list: PlayerRow[]; byId: Map<string, AttendanceRow>; myPlayerId: string | null; showLate?: boolean }) {
  if (list.length === 0) return null;
  const noted = list.filter((p) => byId.get(p.id)?.note);
  return (
    <section className="bg-card rounded-xl border px-4 py-3 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className={cn("size-2.5 rounded-full", dot)} />
        {title} {list.length}명
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {list.map((p) => {
          const a = byId.get(p.id);
          return (
            <li key={p.id} className={cn("bg-muted rounded-md px-2 py-1 text-sm", p.id === myPlayerId && "ring-primary ring-2")}>
              {p.name}
              {showLate && a?.late_minutes != null && <span className="text-muted-foreground ml-1 text-xs">{a.late_minutes}분</span>}
              {a?.rsvp === "yes" && a?.status === "absent" && <span className="ml-1 text-xs text-red-600">노쇼</span>}
            </li>
          );
        })}
      </ul>
      {noted.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {noted.map((p) => (
            <li key={p.id}><span className="font-medium">{p.name}</span><span className="text-muted-foreground"> · {byId.get(p.id)!.note}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 출석 탭 조회 화면 (팀원용). 예정 모임: 투표 현황 + 내 투표 / 끝난 모임: 당일 출석 결과 */
export function AttendanceView({ match, players, attendance, myPlayerId }: Props) {
  const byId = new Map(attendance.map((a) => [a.player_id, a]));
  const mine = myPlayerId ? (byId.get(myPlayerId)?.rsvp ?? null) : null;
  const isUpcoming = match.status === "scheduled";
  const dayDecided = attendance.some((a) => a.status);
  const active = players.filter((p) => p.is_active || byId.has(p.id));

  return (
    <div className="flex flex-col gap-3">
      {isUpcoming && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">내 투표 (참석 여부)</p>
            {myPlayerId ? <RsvpButtons matchId={match.id} mine={mine} /> : <p className="text-muted-foreground text-xs">홈에서 내 이름을 먼저 골라 주세요.</p>}
          </CardContent>
        </Card>
      )}

      {dayDecided ? (
        <>
          {ORDER.map((s) => (
            <Group key={s} title={ATTENDANCE_LABEL[s]} dot={DOT[s]} list={active.filter((p) => byId.get(p.id)?.status === s)} byId={byId} myPlayerId={myPlayerId} showLate={s === "late"} />
          ))}
          <Group title="미입력" dot="bg-muted" list={active.filter((p) => !byId.get(p.id)?.status)} byId={byId} myPlayerId={myPlayerId} />
        </>
      ) : (
        <>
          <Group title="투표 참석" dot="bg-primary" list={active.filter((p) => byId.get(p.id)?.rsvp === "yes")} byId={byId} myPlayerId={myPlayerId} />
          <Group title="투표 불참" dot="bg-neutral-400" list={active.filter((p) => byId.get(p.id)?.rsvp === "no")} byId={byId} myPlayerId={myPlayerId} />
          <Group title="미응답" dot="bg-muted" list={active.filter((p) => !byId.get(p.id)?.rsvp)} byId={byId} myPlayerId={myPlayerId} />
        </>
      )}
    </div>
  );
}
