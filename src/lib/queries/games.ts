import { createClient } from "@/lib/supabase/server";
import type { EventRow, GamePlayerRow, GameRow, PlayerRow, TacticRow } from "@/types/database";

export type LineupEntry = GamePlayerRow & { name: string };
export type EventEntry = EventRow & { scorer_name: string; assist_name: string | null };
export type GameFull = { game: GameRow; lineup: LineupEntry[]; events: EventEntry[]; tactic_name: string | null };

export type MatchGamesData = {
  games: GameFull[];
  /** 참석(present/late) 선수. 편성 후보 */
  attendees: PlayerRow[];
  /** 선수별 출전 쿼터 수 (공평 출전 확인용) */
  quartersByPlayer: Map<string, number>;
  tactics: Pick<TacticRow, "id" | "name" | "format">[];
};

/** 모임의 모든 쿼터 + 편성 + 득점 */
export async function getMatchGames(matchId: string): Promise<MatchGamesData> {
  const supabase = await createClient();
  const [{ data: games }, { data: att }, { data: players }, { data: tactics }] = await Promise.all([
    supabase.from("games").select("*").eq("match_id", matchId).order("game_number"),
    supabase.from("attendance").select("player_id, status, rsvp").eq("match_id", matchId),
    supabase.from("players").select("*").order("name"),
    supabase.from("tactics").select("id, name, format").order("is_favorite", { ascending: false }).order("name"),
  ]);
  const gameIds = (games ?? []).map((g) => g.id);
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.name]));
  // 당일 출석/지각이 확정된 사람, 아직 확정 전이면 투표 참석자
  const attIds = new Set((att ?? []).filter((a) => a.status === "present" || a.status === "late" || (a.status === null && a.rsvp === "yes")).map((a) => a.player_id));
  const attendees = (players ?? []).filter((p) => attIds.has(p.id));

  let lineups: GamePlayerRow[] = [];
  let events: EventRow[] = [];
  if (gameIds.length > 0) {
    const [{ data: gp }, { data: ev }] = await Promise.all([
      supabase.from("game_players").select("*").in("game_id", gameIds),
      supabase.from("events").select("*").in("game_id", gameIds).order("created_at"),
    ]);
    lineups = gp ?? [];
    events = ev ?? [];
  }
  const tacticName = new Map((tactics ?? []).map((t) => [t.id, t.name]));

  const quartersByPlayer = new Map<string, number>();
  for (const r of lineups) quartersByPlayer.set(r.player_id, (quartersByPlayer.get(r.player_id) ?? 0) + 1);

  const full: GameFull[] = (games ?? []).map((game) => ({
    game,
    lineup: lineups.filter((l) => l.game_id === game.id).map((l) => ({ ...l, name: nameOf.get(l.player_id) ?? "?" })),
    events: events
      .filter((e) => e.game_id === game.id)
      .map((e) => ({ ...e, scorer_name: e.scorer_id ? (nameOf.get(e.scorer_id) ?? "?") : "", assist_name: e.assist_id ? (nameOf.get(e.assist_id) ?? null) : null })),
    tactic_name: game.tactic_id ? (tacticName.get(game.tactic_id) ?? null) : null,
  }));

  return { games: full, attendees, quartersByPlayer, tactics: tactics ?? [] };
}
