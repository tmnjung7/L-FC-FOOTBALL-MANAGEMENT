import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  /** 이 화면에 들어갈 기능 목록. 다음 단계에서 구현된다. */
  planned: string[];
};

/** "준비 중" 플레이스홀더. 실제 화면이 만들어지면 교체한다. */
export function Placeholder({ planned }: Props) {
  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <Construction className="text-muted-foreground size-7" />
        </div>
        <div>
          <p className="text-lg font-semibold">준비 중입니다</p>
          <p className="text-muted-foreground mt-1 text-sm">
            다음 단계에서 아래 기능이 들어갑니다.
          </p>
        </div>
        <ul className="text-muted-foreground w-full space-y-1 text-left text-sm">
          {planned.map((item) => (
            <li key={item} className="bg-muted/60 rounded-md px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
