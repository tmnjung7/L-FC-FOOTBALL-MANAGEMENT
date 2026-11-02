"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rsvp, type RsvpStatus } from "@/app/actions/attendance";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/database";

type Props = { matchId: string; mine: AttendanceStatus | null };

/** 다음 모임 카드의 참석 / 불참 버튼 */
export function RsvpButtons({ matchId, mine }: Props) {
  const [pending, startTransition] = useTransition();

  function choose(status: RsvpStatus) {
    startTransition(async () => {
      const result = await rsvp(matchId, status);
      if ("error" in result) toast.error(result.error);
      else toast.success(status === "present" ? "참석으로 응답했습니다" : "불참으로 응답했습니다");
    });
  }

  const isGoing = mine === "present";
  const isNotGoing = mine === "excused";

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        size="lg"
        variant={isGoing ? "default" : "outline"}
        className={cn(isGoing && "ring-primary/30 ring-2")}
        disabled={pending}
        onClick={() => choose("present")}
        aria-pressed={isGoing}
      >
        <Check /> 참석
      </Button>
      <Button
        size="lg"
        variant={isNotGoing ? "secondary" : "outline"}
        className={cn(isNotGoing && "ring-2 ring-neutral-300")}
        disabled={pending}
        onClick={() => choose("excused")}
        aria-pressed={isNotGoing}
      >
        <X /> 불참
      </Button>
    </div>
  );
}
