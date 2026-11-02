import { createClient } from "@/lib/supabase/server";
import type { GameRow, MatchRow, PlayerRow, PlayerSeasonStatsRow, TeamSide } from "@/types/database";

/** 선수 목록 (활성 → 이름순, 비활성은 뒤) + 시즌 요약 */
export async function getPlayersWithStats(): Promise<{ players: PlayerRow[]; stats: Map<string, PlayerSeasonStatsRow> }> {
  const supabase = await createClient();
  const [{ data: players }, { data: stats }] = await Promise.all([
    supabase.from("players").select("*").order("is_active", { ascending: false }).order("name"),
    supabase.from("v_player_season_stats").select("*"),
  ]);
  return {
    players: players ?? [],
    stats: new Map((stats ?? []).map((s) => [s.player_id, s])),
  };
}

export type GameRecord = {
  game_id: string;
  match_id: string;
  match_date: string;
  venue: string | null;
  game_number: number;
  team: TeamSide;
  position: string | null;
  team_a_score: number;
  team_b_score: number;
  result: "W" | "D" | "L";
  goals: number;
  assists: number;
};

export type MatchForm = {
  match_id: string;
  match_date: string;
  quarters: number;
  goals: number;
  assists: number;
  avg_rating: number | null;
};

export type PlayerDetail = {
  player: PlayerRow;
  stats: PlayerSeasonStatsRow | null;
  /** 최근 5개 모임 폼 (오래된 순, 차트용) */
  form: MatchForm[];
  /** 최근 출전 쿼터 기록 (최신순) */
  games: GameRecord[];
};

type GpRow = {
  team: TeamSide;
  position: string | null;
  game: (Pick<GameRow, "id" | "game_number" | "team_a_score" | "team_b_score"> & {
    match: Pick<MatchRow, "id" | "match_date" | "venue" | "status"> | null;
  }) | null;
};

export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (!player) return null;

  const [{ data: stats }, { data: gpRaw }, { data: events }, { data: ratings }] = await Promise.all([
    supabase.from("v_player_season_stats").select("*").eq("player_id", id).maybeSingle(),
    supabase
      .from("game_players")
      .select("team, position, game:games(id, game_number, team_a_score, team_b_score, match:matches(id, match_date, venue, status))")
      .eq("player_id", id),
    supabase
      .from("events")
      .select("game_id, scorer_id, assist_id, is_own_goal")
      .or(`scorer_id.eq.${id},assist_id.eq.${id}`),
    supabase.from("ratings").select("match_id, score").eq("player_id", id).not("match_id", "is", null),
  ]);

  // 쿼터별 득점·어시
  const goalsByGame = new Map<string, number>();
  const assistsByGame = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.scorer_id === id && !e.is_own_goal) goalsByGame.set(e.game_id, (goalsByGame.get(e.game_id) ?? 0) + 1);
    if (e.assist_id === id) assistsByGame.set(e.game_id, (assistsByGame.get(e.game_id) ?? 0) + 1);
  }
  // 모임별 평점 평균
  const ratingByMatch = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    if (!r.match_id) continue;
    const cur = ratingByMatch.get(r.match_id) ?? { sum: 0, n: 0 };
    ratingByMatch.set(r.match_id, { sum: cur.sum + Number(r.score), n: cur.n + 1 });
  }

  const games: GameRecord[] = ((gpRaw ?? []) as unknown as GpRow[])
    .filter((gp) => gp.game?.match && gp.game.match.status === "done")
    .map((gp): GameRecord => {
      const g = gp.game!;
      const m = g.match!;
      const mine = gp.team === "A" ? g.team_a_score : g.team_b_score;
      const theirs = gp.team === "A" ? g.team_b_score : g.team_a_score;
      return {
        game_id: g.id,
        match_id: m.id,
        match_date: m.match_date,
        venue: m.venue,
        game_number: g.game_number,
        team: gp.team,
        position: gp.position,
        team_a_score: g.team_a_score,
        team_b_score: g.team_b_score,
        result: mine > theirs ? "W" : mine === theirs ? "D" : "L",
        goals: goalsByGame.get(g.id) ?? 0,
        assists: assistsByGame.get(g.id) ?? 0,
      };
    })
    .sort((a, b) => (a.match_date === b.match_date ? b.game_number - a.game_number : b.match_date.localeCompare(a.match_date)));

  // 모임별 폼 (최근 5개, 오래된 순)
  const byMatch = new Map<string, MatchForm>();
  for (const g of games) {
    const cur = byMatch.get(g.match_id) ?? {
      match_id: g.match_id,
      match_date: g.match_date,
      quarters: 0,
      goals: 0,
      assists: 0,
      avg_rating: null,
    };
    cur.quarters += 1;
    cur.goals += g.goals;
    cur.assists += g.assists;
    byMatch.set(g.match_id, cur);
  }
  for (const [mid, f] of byMatch) {
    const r = ratingByMatch.get(mid);
    if (r && r.n > 0) f.avg_rating = Math.round((r.sum / r.n) * 10) / 10;
  }
  const form = [...byMatch.values()].sort((a, b) => b.match_date.localeCompare(a.match_date)).slice(0, 5).reverse();

  return { player, stats: stats ?? null, form, games };
}
