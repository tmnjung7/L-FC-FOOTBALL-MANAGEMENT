import { createClient } from "@/lib/supabase/server";
import type { PlayerRow, TacticRow } from "@/types/database";

export type TacticWithUsage = TacticRow & { used_games: number };

/** 저장된 전술 목록 (즐겨찾기 → 최근 수정순) + 사용된 쿼터 수 */
export async function getTactics(): Promise<TacticWithUsage[]> {
  const supabase = await createClient();
  const [{ data: tactics }, { data: games }] = await Promise.all([
    supabase.from("tactics").select("*").order("is_favorite", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("games").select("tactic_id").not("tactic_id", "is", null),
  ]);
  const usage = new Map<string, number>();
  for (const g of games ?? []) if (g.tactic_id) usage.set(g.tactic_id, (usage.get(g.tactic_id) ?? 0) + 1);
  return (tactics ?? []).map((t) => ({ ...t, used_games: usage.get(t.id) ?? 0 }));
}

/** 전술판에 올릴 활성 선수 */
export async function getActivePlayers(): Promise<PlayerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("is_active", true).order("name");
  return data ?? [];
}
