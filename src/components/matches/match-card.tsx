import Link from "next/link";
import { ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, relativeDays } from "@/lib/date";
import type { MatchSummaryRow } from "@/types/database";
import { resultLabel } from "@/lib/match-labels";
import { MatchDeleteButton } from "@/components/matches/match-delete-button";
import { formatDateShort } from "@/lib/date";

const STATUS: Record<MatchSummaryRow["status"], { label: string; variant: "default" | "muted" | "destructive" }> = {
  scheduled: { label: "예정", variant: "default" },
  done: { label: "완료", variant: "muted" },
  cancelled: { label: "취소", variant: "destructive" },
};

export function MatchCard({ m, canDelete = false }: { m: MatchSummaryRow; canDelete?: boolean }) {
  const isUpcoming = m.status === "scheduled";
  const st = STATUS[m.status];
  return (
    <li className="flex items-center gap-1">
      <Link href={`/matches/${m.match_id}`} className="bg-card hover:bg-accent flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{formatDate(m.match_date)}</p>
            <Badge variant={st.variant} className="h-5">{st.label}</Badge>
            <Badge variant="outline" className="h-5">{m.format}</Badge>
            {m.opponent && <Badge variant="teamB" className="h-5 max-w-28 truncate">vs {m.opponent}</Badge>}
            {isUpcoming && <span className="text-muted-foreground text-xs">{relativeDays(m.match_date)}</span>}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {m.start_time && <span className="flex items-center gap-1"><Clock className="size-3" />{formatTime(m.start_time)}</span>}
            <span className="flex items-center gap-1 truncate"><MapPin className="size-3" />{m.venue || "장소 미정"}</span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {isUpcoming ? `투표 참석 ${m.rsvp_yes_count}명` : `${m.attendee_count}명`}
            </span>
            {m.status === "done" && (
              <span>
                {m.game_count}쿼터 · {resultLabel(m)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      </Link>
      {canDelete && <MatchDeleteButton matchId={m.match_id} label={formatDateShort(m.match_date)} gameCount={m.game_count} />}
    </li>
  );
}
