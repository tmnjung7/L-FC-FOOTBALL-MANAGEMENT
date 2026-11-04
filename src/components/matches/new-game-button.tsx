"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createGame } from "@/app/actions/games";

type Props = { matchId: string; hasPrevious: boolean; size?: "sm" | "lg"; label?: string };

/** "+ 쿼터" — 직전 쿼터가 있으면 편성을 복사해 만들고 바로 그 쿼터 화면으로 이동 */
export function NewGameButton({ matchId, hasPrevious, size = "sm", label }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={size}
      className={size === "lg" ? "h-14 text-base" : undefined}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await createGame(matchId, { copyPrevious: hasPrevious });
          if ("error" in r) toast.error(r.error);
          else {
            toast.success(hasPrevious ? "직전 편성을 복사해 쿼터를 만들었습니다" : "첫 쿼터를 만들었습니다");
            router.push(`/matches/${matchId}/games/${r.id}`);
          }
        })
      }
    >
      <Plus /> {pending ? "만드는 중…" : (label ?? (hasPrevious ? "다음 쿼터" : "쿼터 추가"))}
    </Button>
  );
}
