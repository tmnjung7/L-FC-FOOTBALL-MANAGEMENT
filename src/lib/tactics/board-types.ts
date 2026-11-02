/**
 * 전술판 저장 구조 (tactics.board_json)
 * 좌표는 모두 0~1 비율. x: 0 = 왼쪽(우리) 골라인, 1 = 오른쪽(상대) 골라인. y: 0 = 위쪽 사이드라인.
 * 화면 픽셀 변환은 렌더링 때만 한다 (휴대폰/태블릿 어디서 열어도 같은 위치).
 */
import type { MatchFormat } from "@/types/database";

export type MarkerKind = "us" | "them" | "ball";
export type Marker = { id: string; kind: MarkerKind; x: number; y: number; label: string; playerId: string | null };
export type ArrowStyle = "move" | "pass";
export type Arrow = { id: string; from: [number, number]; to: [number, number]; style: ArrowStyle };
export type Zone = { id: string; shape: "rect" | "circle"; x: number; y: number; w: number; h: number };
export type Note = { id: string; x: number; y: number; text: string };

export type BoardJson = {
  version: 1;
  format: MatchFormat;
  orientation: "vertical" | "horizontal";
  markers: Marker[];
  arrows: Arrow[];
  zones: Zone[];
  notes: Note[];
  /** 프레임(1→2→3 순서 움직임)은 2차. 구조만 열어 둠 */
  frames: BoardJson[];
};

export const COURT = { length: 40, width: 20 } as const; // m
/** 격자 간격 (m). 2m 칸 → 20 x 10 */
export const GRID_M = 2;

export function emptyBoard(format: MatchFormat = "6v6"): BoardJson {
  return {
    version: 1,
    format,
    orientation: "vertical",
    markers: [{ id: "ball", kind: "ball", x: 0.5, y: 0.5, label: "", playerId: null }],
    arrows: [],
    zones: [],
    notes: [],
    frames: [],
  };
}

export function uid(prefix = "m"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 격자 교차점에 맞추기 */
export function snapToGrid(x: number, y: number): [number, number] {
  const sx = GRID_M / COURT.length; // x 한 칸 비율
  const sy = GRID_M / COURT.width;
  return [clamp01(Math.round(x / sx) * sx), clamp01(Math.round(y / sy) * sy)];
}

/**
 * 비율 좌표 ↔ 픽셀. 세로 모드(휴대폰)는 코트를 세워서 그리므로 x(길이)가 화면 세로가 된다.
 * 세로 모드에서 우리 골은 아래(화면 하단), 상대 골은 위.
 */
export type Viewport = { w: number; h: number; orientation: "vertical" | "horizontal" };

export function toPx(x: number, y: number, vp: Viewport): [number, number] {
  if (vp.orientation === "horizontal") return [x * vp.w, y * vp.h];
  return [y * vp.w, (1 - x) * vp.h];
}
export function fromPx(px: number, py: number, vp: Viewport): [number, number] {
  if (vp.orientation === "horizontal") return [clamp01(px / vp.w), clamp01(py / vp.h)];
  return [clamp01(1 - py / vp.h), clamp01(px / vp.w)];
}
/** 미터 → 픽셀 (길이 방향 기준) */
export function mToPx(m: number, vp: Viewport): number {
  const lengthPx = vp.orientation === "horizontal" ? vp.w : vp.h;
  return (m / COURT.length) * lengthPx;
}

/** 저장된 JSON 을 안전하게 읽기 (버전·누락 필드 보정) */
export function parseBoard(raw: unknown, fallbackFormat: MatchFormat = "6v6"): BoardJson {
  const b = (raw ?? {}) as Partial<BoardJson>;
  const base = emptyBoard(b.format ?? fallbackFormat);
  return {
    ...base,
    orientation: b.orientation ?? base.orientation,
    markers: Array.isArray(b.markers) && b.markers.length ? b.markers : base.markers,
    arrows: Array.isArray(b.arrows) ? b.arrows : [],
    zones: Array.isArray(b.zones) ? b.zones : [],
    notes: Array.isArray(b.notes) ? b.notes : [],
    frames: Array.isArray(b.frames) ? b.frames : [],
  };
}
