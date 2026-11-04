import type { TeamSide } from "@/types/database";

type MatchLike = { opponent: string | null };

/** 자체전이면 A팀/B팀, 상대팀 경기면 우리/상대팀 이름 */
export function isExternal(m: MatchLike): boolean {
  return !!m.opponent;
}
export function teamLabel(m: MatchLike, side: TeamSide): string {
  if (!m.opponent) return side === "A" ? "A팀" : "B팀";
  return side === "A" ? "우리" : m.opponent;
}
/** 결과 문구: 자체전은 "A 3승 2무 4패", 상대팀 경기는 "3:2 승" */
export function resultLabel(m: MatchLike & { team_a_goals: number; team_b_goals: number; team_a_wins: number; draws: number; team_b_wins: number }): string {
  if (!m.opponent) return `A ${m.team_a_wins}승 ${m.draws}무 ${m.team_b_wins}패`;
  const r = m.team_a_goals > m.team_b_goals ? "승" : m.team_a_goals === m.team_b_goals ? "무" : "패";
  return `${m.team_a_goals}:${m.team_b_goals} ${r}`;
}
