/**
 * 포메이션 프리셋. 좌표는 0~1 비율 (x: 우리 골라인 0 → 상대 골라인 1).
 * 프리셋을 추가하려면 이 파일에만 항목을 넣으면 된다.
 */
import type { MatchFormat, PositionType } from "@/types/database";

export type Slot = { label: string; position: PositionType; x: number; y: number };
export type Formation = { key: string; name: string; format: MatchFormat; slots: Slot[] };

const GK: Slot = { label: "GK", position: "GK", x: 0.06, y: 0.5 };

export const FORMATIONS: Formation[] = [
  // ---- 5v5: GK 1 + 필드 4
  { key: "5-1-2-1", name: "1-2-1 (다이아몬드)", format: "5v5", slots: [GK,
    { label: "FX", position: "FIXO", x: 0.3, y: 0.5 },
    { label: "AL", position: "ALA", x: 0.52, y: 0.22 },
    { label: "AR", position: "ALA", x: 0.52, y: 0.78 },
    { label: "PV", position: "PIVO", x: 0.78, y: 0.5 }] },
  { key: "5-2-2", name: "2-2 (박스)", format: "5v5", slots: [GK,
    { label: "DL", position: "FIXO", x: 0.32, y: 0.28 },
    { label: "DR", position: "FIXO", x: 0.32, y: 0.72 },
    { label: "FL", position: "PIVO", x: 0.7, y: 0.28 },
    { label: "FR", position: "PIVO", x: 0.7, y: 0.72 }] },
  { key: "5-1-3", name: "1-3 (공격형)", format: "5v5", slots: [GK,
    { label: "FX", position: "FIXO", x: 0.3, y: 0.5 },
    { label: "AL", position: "ALA", x: 0.66, y: 0.2 },
    { label: "PV", position: "PIVO", x: 0.74, y: 0.5 },
    { label: "AR", position: "ALA", x: 0.66, y: 0.8 }] },
  { key: "5-3-1", name: "3-1 (수비형)", format: "5v5", slots: [GK,
    { label: "DL", position: "FIXO", x: 0.3, y: 0.22 },
    { label: "DC", position: "FIXO", x: 0.26, y: 0.5 },
    { label: "DR", position: "FIXO", x: 0.3, y: 0.78 },
    { label: "PV", position: "PIVO", x: 0.72, y: 0.5 }] },
  // ---- 6v6: GK 1 + 필드 5
  { key: "6-2-1-2", name: "2-1-2", format: "6v6", slots: [GK,
    { label: "DL", position: "FIXO", x: 0.28, y: 0.28 },
    { label: "DR", position: "FIXO", x: 0.28, y: 0.72 },
    { label: "MC", position: "ALA", x: 0.5, y: 0.5 },
    { label: "FL", position: "PIVO", x: 0.74, y: 0.28 },
    { label: "FR", position: "PIVO", x: 0.74, y: 0.72 }] },
  { key: "6-1-2-2", name: "1-2-2", format: "6v6", slots: [GK,
    { label: "FX", position: "FIXO", x: 0.26, y: 0.5 },
    { label: "AL", position: "ALA", x: 0.5, y: 0.25 },
    { label: "AR", position: "ALA", x: 0.5, y: 0.75 },
    { label: "FL", position: "PIVO", x: 0.76, y: 0.32 },
    { label: "FR", position: "PIVO", x: 0.76, y: 0.68 }] },
  { key: "6-2-2-1", name: "2-2-1", format: "6v6", slots: [GK,
    { label: "DL", position: "FIXO", x: 0.28, y: 0.3 },
    { label: "DR", position: "FIXO", x: 0.28, y: 0.7 },
    { label: "AL", position: "ALA", x: 0.52, y: 0.25 },
    { label: "AR", position: "ALA", x: 0.52, y: 0.75 },
    { label: "PV", position: "PIVO", x: 0.78, y: 0.5 }] },
  { key: "6-3-2", name: "3-2", format: "6v6", slots: [GK,
    { label: "DL", position: "FIXO", x: 0.3, y: 0.22 },
    { label: "DC", position: "FIXO", x: 0.26, y: 0.5 },
    { label: "DR", position: "FIXO", x: 0.3, y: 0.78 },
    { label: "FL", position: "PIVO", x: 0.72, y: 0.32 },
    { label: "FR", position: "PIVO", x: 0.72, y: 0.68 }] },
];

export function formationsFor(format: MatchFormat): Formation[] {
  return FORMATIONS.filter((f) => f.format === format);
}

/**
 * 선수 자동 배정 제안: 각 슬롯에 선호 포지션이 맞는 선수를 먼저, 남은 슬롯은 ANY/나머지 순.
 * 반환: slot index → player
 */
export function suggestAssignment<P extends { id: string; preferred_position: PositionType }>(slots: Slot[], players: P[]): (P | null)[] {
  const pool = [...players];
  const result: (P | null)[] = slots.map(() => null);
  const take = (pred: (p: P) => boolean) => {
    const i = pool.findIndex(pred);
    return i >= 0 ? pool.splice(i, 1)[0] : null;
  };
  // 1) 정확히 맞는 포지션
  slots.forEach((s, i) => { result[i] = take((p) => p.preferred_position === s.position); });
  // 2) ANY
  slots.forEach((s, i) => { if (!result[i]) result[i] = take((p) => p.preferred_position === "ANY"); });
  // 3) 아무나
  slots.forEach((s, i) => { if (!result[i]) result[i] = take(() => true); });
  return result;
}
