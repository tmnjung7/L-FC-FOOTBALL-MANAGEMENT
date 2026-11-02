/**
 * Supabase 데이터베이스 타입 (supabase/migrations/0001_init.sql 과 1:1 대응)
 *
 * 스키마를 바꾸면 이 파일도 같이 고친다. (나중에 `supabase gen types typescript` 로 자동 생성 가능)
 * - Row    : SELECT 결과 한 행
 * - Insert : INSERT 시 필요한 값 (기본값 있는 컬럼은 선택)
 * - Update : UPDATE 시 넘기는 값 (전부 선택)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// ENUM
// ---------------------------------------------------------------------------
export type PositionType = "GK" | "FIXO" | "ALA" | "PIVO" | "ANY";
export type MatchFormat = "5v5" | "6v6";
export type MatchStatus = "scheduled" | "done" | "cancelled";
export type TeamSide = "A" | "B";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type TacticCategory = "formation" | "set_piece" | "press" | "other";
export type RatingScope = "match" | "quarter";
export type PeriodType = "month" | "quarter" | "year" | "custom";

// ---------------------------------------------------------------------------
// 행 타입
// ---------------------------------------------------------------------------
export type PlayerRow = {
  id: string;
  name: string;
  nickname: string | null;
  preferred_position: PositionType;
  jersey_number: number | null;
  is_active: boolean;
  joined_at: string; // date 'YYYY-MM-DD'
  user_id: string | null;
  created_at: string;
};

export type TacticRow = {
  id: string;
  name: string;
  format: MatchFormat;
  category: TacticCategory;
  description: string | null;
  board_json: Json; // 4단계에서 TacticBoard 타입으로 좁혀 사용
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type MatchRow = {
  id: string;
  match_date: string; // 'YYYY-MM-DD'
  start_time: string | null; // 'HH:MM:SS'
  venue: string | null;
  format: MatchFormat;
  status: MatchStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type GameRow = {
  id: string;
  match_id: string;
  game_number: number;
  team_a_score: number;
  team_b_score: number;
  duration_min: number;
  tactic_id: string | null;
  created_at: string;
};

export type GamePlayerRow = {
  id: string;
  game_id: string;
  player_id: string;
  team: TeamSide;
  position: PositionType | null;
};

export type EventRow = {
  id: string;
  game_id: string;
  minute: number | null;
  scorer_id: string;
  assist_id: string | null;
  team: TeamSide;
  is_own_goal: boolean;
  created_at: string;
};

export type RatingRow = {
  id: string;
  match_id: string | null;
  game_id: string | null;
  player_id: string;
  rater_id: string;
  score: number; // 1.0 ~ 10.0, 0.5 단위
  created_at: string;
  updated_at: string;
};

export type RsvpAnswer = "yes" | "no";

export type AttendanceRow = {
  id: string;
  match_id: string;
  player_id: string;
  /** 당일 확정 (출석/지각/결석/사전통보). 투표만 한 상태면 null */
  status: AttendanceStatus | null;
  /** 사전 투표 결과 (카톡 투표). 참석 yes / 불참 no */
  rsvp: RsvpAnswer | null;
  late_minutes: number | null;
  note: string | null;
};

export type MatchFeedbackRow = {
  id: string;
  match_id: string;
  player_id: string;
  comment: string | null;
  mvp_vote_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchReportRow = {
  id: string;
  match_id: string;
  summary_json: Json;
  narrative: string | null;
  image_url: string | null;
  generated_at: string;
};

export type PeriodReportRow = {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  title: string;
  summary_json: Json;
  narrative: string | null;
  image_url: string | null;
  generated_at: string;
};

export type TeamSettingsRow = {
  id: number;
  team_name: string;
  default_format: MatchFormat;
  default_quarter_min: number;
  late_threshold_min: number;
  rating_enabled: boolean;
  rating_scope: RatingScope;
  rating_deadline_hours: number;
  feedback_edit_hours: number;
  updated_at: string;
};

/** fn_player_season_stats / v_player_season_stats 한 행 */
export type PlayerSeasonStatsRow = {
  player_id: string;
  name: string;
  is_active: boolean;
  matches_played: number;
  quarters_played: number;
  rest_quarters: number;
  goals: number;
  assists: number;
  own_goals: number;
  avg_rating: number | null;
  rating_count: number;
  attendance_rate: number | null; // 0~100, 분모 0이면 null
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  wins: number;
  draws: number;
  losses: number;
  positions_played: Partial<Record<PositionType, number>>; // 실제 뛴 포지션별 쿼터 수
  main_position: PositionType | null; // 가장 많이 뛴 포지션
  no_show_count: number; // 투표 참석인데 당일 무단 결석
};

/** v_match_summary 한 행 */
export type MatchSummaryRow = {
  match_id: string;
  match_date: string;
  start_time: string | null;
  venue: string | null;
  format: MatchFormat;
  status: MatchStatus;
  attendee_count: number;
  late_count: number;
  game_count: number;
  total_goals: number;
  team_a_wins: number;
  draws: number;
  team_b_wins: number;
  quarters_by_player: { player_id: string; name: string; quarters: number }[];
  rsvp_yes_count: number;
  rsvp_no_count: number;
};

// ---------------------------------------------------------------------------
// Insert / Update 헬퍼
//   Insert: 기본값이 있는 컬럼(K)은 생략 가능
// ---------------------------------------------------------------------------
type WithDefaults<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>;

type Rel<FK extends string, Col extends string, Ref extends string, OneToOne extends boolean = false> = {
  foreignKeyName: FK;
  columns: [Col];
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

// ---------------------------------------------------------------------------
// Database (supabase-js 제네릭에 넘기는 전체 스키마)
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      players: {
        Row: PlayerRow;
        Insert: WithDefaults<PlayerRow, "id" | "nickname" | "preferred_position" | "jersey_number" | "is_active" | "joined_at" | "user_id" | "created_at">;
        Update: Partial<PlayerRow>;
        Relationships: [];
      };
      tactics: {
        Row: TacticRow;
        Insert: WithDefaults<TacticRow, "id" | "format" | "category" | "description" | "board_json" | "is_favorite" | "created_at" | "updated_at">;
        Update: Partial<TacticRow>;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: WithDefaults<MatchRow, "id" | "start_time" | "venue" | "format" | "status" | "notes" | "created_by" | "created_at">;
        Update: Partial<MatchRow>;
        Relationships: [];
      };
      games: {
        Row: GameRow;
        Insert: WithDefaults<GameRow, "id" | "team_a_score" | "team_b_score" | "duration_min" | "tactic_id" | "created_at">;
        Update: Partial<GameRow>;
        Relationships: [
          Rel<"games_match_id_fkey", "match_id", "matches">,
          Rel<"games_tactic_id_fkey", "tactic_id", "tactics">,
        ];
      };
      game_players: {
        Row: GamePlayerRow;
        Insert: WithDefaults<GamePlayerRow, "id" | "position">;
        Update: Partial<GamePlayerRow>;
        Relationships: [
          Rel<"game_players_game_id_fkey", "game_id", "games">,
          Rel<"game_players_player_id_fkey", "player_id", "players">,
        ];
      };
      events: {
        Row: EventRow;
        Insert: WithDefaults<EventRow, "id" | "minute" | "assist_id" | "is_own_goal" | "created_at">;
        Update: Partial<EventRow>;
        Relationships: [
          Rel<"events_game_id_fkey", "game_id", "games">,
          Rel<"events_scorer_id_fkey", "scorer_id", "players">,
          Rel<"events_assist_id_fkey", "assist_id", "players">,
        ];
      };
      ratings: {
        Row: RatingRow;
        Insert: WithDefaults<RatingRow, "id" | "match_id" | "game_id" | "created_at" | "updated_at">;
        Update: Partial<RatingRow>;
        Relationships: [
          Rel<"ratings_match_id_fkey", "match_id", "matches">,
          Rel<"ratings_game_id_fkey", "game_id", "games">,
          Rel<"ratings_player_id_fkey", "player_id", "players">,
          Rel<"ratings_rater_id_fkey", "rater_id", "players">,
        ];
      };
      attendance: {
        Row: AttendanceRow;
        Insert: WithDefaults<AttendanceRow, "id" | "status" | "rsvp" | "late_minutes" | "note">;
        Update: Partial<AttendanceRow>;
        Relationships: [
          Rel<"attendance_match_id_fkey", "match_id", "matches">,
          Rel<"attendance_player_id_fkey", "player_id", "players">,
        ];
      };
      match_feedback: {
        Row: MatchFeedbackRow;
        Insert: WithDefaults<MatchFeedbackRow, "id" | "comment" | "mvp_vote_id" | "created_at" | "updated_at">;
        Update: Partial<MatchFeedbackRow>;
        Relationships: [
          Rel<"match_feedback_match_id_fkey", "match_id", "matches">,
          Rel<"match_feedback_player_id_fkey", "player_id", "players">,
          Rel<"match_feedback_mvp_vote_id_fkey", "mvp_vote_id", "players">,
        ];
      };
      match_reports: {
        Row: MatchReportRow;
        Insert: WithDefaults<MatchReportRow, "id" | "narrative" | "image_url" | "generated_at">;
        Update: Partial<MatchReportRow>;
        Relationships: [Rel<"match_reports_match_id_fkey", "match_id", "matches", true>];
      };
      period_reports: {
        Row: PeriodReportRow;
        Insert: WithDefaults<PeriodReportRow, "id" | "narrative" | "image_url" | "generated_at">;
        Update: Partial<PeriodReportRow>;
        Relationships: [];
      };
      team_settings: {
        Row: TeamSettingsRow;
        Insert: Partial<TeamSettingsRow>;
        Update: Partial<TeamSettingsRow>;
        Relationships: [];
      };
    };
    Views: {
      v_player_season_stats: { Row: PlayerSeasonStatsRow; Relationships: [] };
      v_match_summary: { Row: MatchSummaryRow; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      current_player_id: { Args: Record<string, never>; Returns: string | null };
      fn_player_season_stats: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: PlayerSeasonStatsRow[];
      };
    };
    Enums: {
      position_type: PositionType;
      match_format: MatchFormat;
      match_status: MatchStatus;
      team_side: TeamSide;
      attendance_status: AttendanceStatus;
      tactic_category: TacticCategory;
      rating_scope: RatingScope;
      period_type: PeriodType;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// 편의 타입: Tables<'players'>, TablesInsert<'events'> 처럼 사용
// ---------------------------------------------------------------------------
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];

/** 화면 표시용 한국어 라벨 */
export const POSITION_LABEL: Record<PositionType, string> = {
  GK: "골키퍼",
  FIXO: "픽소(수비)",
  ALA: "알라(측면)",
  PIVO: "피보(공격)",
  ANY: "무관",
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
  excused: "사전통보",
};

export const TACTIC_CATEGORY_LABEL: Record<TacticCategory, string> = {
  formation: "포메이션",
  set_piece: "세트피스",
  press: "압박",
  other: "기타",
};

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  month: "월간",
  quarter: "분기",
  year: "연간",
  custom: "직접 지정",
};
