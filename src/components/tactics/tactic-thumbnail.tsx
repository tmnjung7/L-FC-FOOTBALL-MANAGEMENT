import { parseBoard } from "@/lib/tactics/board-types";
import type { Json } from "@/types/database";

/** 저장 전술 카드용 미니 썸네일 (SVG, 가로 코트) */
export function TacticThumbnail({ board, className }: { board: Json; className?: string }) {
  const b = parseBoard(board);
  const W = 120, H = 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="전술 미리보기">
      <rect x="0" y="0" width={W} height={H} rx="4" fill="#2f8f4e" />
      <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke="#e8f5e9" strokeWidth="1" />
      <line x1={W / 2} y1="2" x2={W / 2} y2={H - 2} stroke="#e8f5e9" strokeWidth="1" />
      <circle cx={W / 2} cy={H / 2} r="7" fill="none" stroke="#e8f5e9" strokeWidth="1" />
      {b.zones.map((z) => (
        <rect key={z.id} x={z.x * W} y={z.y * H} width={z.w * W} height={z.h * H} fill="#ffeb3b" opacity="0.3" />
      ))}
      {b.arrows.map((a) => (
        <line key={a.id} x1={a.from[0] * W} y1={a.from[1] * H} x2={a.to[0] * W} y2={a.to[1] * H} stroke="#fff" strokeWidth="1" strokeDasharray={a.style === "pass" ? "2 2" : undefined} />
      ))}
      {b.markers.map((m) => (
        <circle key={m.id} cx={m.x * W} cy={m.y * H} r={m.kind === "ball" ? 2 : 3.5} fill={m.kind === "us" ? "#1e88e5" : m.kind === "them" ? "#e53935" : "#fff"} stroke="#fff" strokeWidth="0.6" />
      ))}
    </svg>
  );
}
