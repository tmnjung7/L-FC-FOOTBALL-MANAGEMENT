"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type Konva from "konva";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardToolbar } from "@/components/tactics/board-toolbar";
import type { TacticWithUsage } from "@/lib/queries/tactics";
import type { PlayerRow } from "@/types/database";

// react-konva 는 브라우저 canvas 전용 → 서버 렌더링 제외
const BoardCanvas = dynamic(() => import("@/components/tactics/board-canvas").then((m) => m.BoardCanvas), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto aspect-[1/2] w-full max-w-sm rounded-xl" />,
});

type Props = { players: PlayerRow[]; tactics: TacticWithUsage[]; isAdmin: boolean };

/** 전술판 = 캔버스 + 도구. 컨테이너 폭 640px 이상(태블릿)이면 캔버스가 가로 코트로 눕는다 */
export function TacticsBoard({ players, tactics, isAdmin }: Props) {
  const stageRef = useRef<Konva.Stage | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <BoardCanvas stageRef={stageRef} />
      <BoardToolbar players={players} tactics={tactics} isAdmin={isAdmin} stageRef={stageRef} />
    </div>
  );
}
