import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** 공용 계정으로 들어왔는데 아직 내 이름을 안 고른 경우 */
export function PickNameCard() {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserRound className="text-primary size-6 shrink-0" />
          <div>
            <p className="font-semibold">내 이름을 골라 주세요</p>
            <p className="text-muted-foreground text-xs">참석 응답·평점이 그 이름으로 기록됩니다</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/whoami">선택</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
