-- =====================================================================
-- 풋살 팀 매니저 — 초기 스키마 (0001_init.sql)
-- Supabase SQL Editor 에 전체를 붙여넣고 Run 하면 된다.
--
-- 구조 요약
--   players        선수
--   matches        모임(일요일 경기일)            1
--   games          모임 안의 쿼터(8~10개)         N  ← 모든 개인 기록은 이 단위
--   game_players   쿼터별 출전 명단 (A/B 팀)
--   events         득점 이벤트 (어시스트는 같은 행)
--   ratings        평점 (모임 단위 또는 쿼터 단위)
--   attendance     모임 출석/지각/결석/사전통보
--   tactics        전술판 저장 (board_json)
--   match_feedback 경기 후 한 줄 피드백 + MVP 투표
--   match_reports  자동 생성된 경기 보고서
--   period_reports 월말·분기·연말 결산 리포트 스냅샷
--   team_settings  팀 설정 (1행)
--   v_player_season_stats / v_match_summary  집계 뷰
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ENUM (고정된 선택지)
-- ---------------------------------------------------------------------
create type public.position_type     as enum ('GK', 'FIXO', 'ALA', 'PIVO', 'ANY');
create type public.match_format      as enum ('5v5', '6v6');
create type public.match_status      as enum ('scheduled', 'done', 'cancelled');
create type public.team_side         as enum ('A', 'B');
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
create type public.tactic_category   as enum ('formation', 'set_piece', 'press', 'other');
create type public.rating_scope      as enum ('match', 'quarter');
create type public.period_type       as enum ('month', 'quarter', 'year', 'custom');

-- ---------------------------------------------------------------------
-- 1. 공통 함수
-- ---------------------------------------------------------------------

-- 현재 로그인한 사용자가 admin 인가? (auth.users.app_metadata.role = 'admin')
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------

-- 선수
create table public.players (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  nickname           text,
  preferred_position public.position_type not null default 'ANY',
  jersey_number      int check (jersey_number is null or jersey_number between 0 and 99),
  is_active          boolean not null default true,
  joined_at          date not null default current_date,
  user_id            uuid unique references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);
comment on table public.players is '선수. 삭제하지 않고 is_active=false 로 비활성화 (기록 보존)';
comment on column public.players.user_id is '로그인 계정과 선수 연결. 본인 평점/피드백 권한 판단에 사용';

-- 전술 (games 가 참조하므로 먼저 생성)
create table public.tactics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  format      public.match_format not null default '6v6',
  category    public.tactic_category not null default 'formation',
  description text,
  board_json  jsonb not null default '{"version":1,"format":"6v6","orientation":"vertical","markers":[],"arrows":[],"zones":[],"notes":[],"frames":[]}'::jsonb,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.tactics.board_json is '전술판 상태. 좌표는 0~1 비율. version 필드로 구조 버전 관리';

-- 모임 (일요일 경기일)
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  match_date date not null,
  start_time time,
  venue      text,
  format     public.match_format not null default '6v6',
  status     public.match_status not null default 'scheduled',
  notes      text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.matches is '모임(경기일). 한 모임 = 여러 쿼터(games)';

-- 쿼터 (한 모임 안의 개별 게임)
create table public.games (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  game_number  int not null check (game_number >= 1),
  team_a_score int not null default 0 check (team_a_score >= 0),
  team_b_score int not null default 0 check (team_b_score >= 0),
  duration_min int not null default 12 check (duration_min between 1 and 60),
  tactic_id    uuid references public.tactics (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (match_id, game_number)
);
comment on table public.games is '쿼터. 모임당 8~10개. 출전·득점·승패는 모두 이 단위';
comment on column public.games.team_a_score is '검증 규칙: events 중 team=A 건수와 일치해야 함 (자책골은 상대팀 득점으로 team 에 기록)';

-- 쿼터별 출전 명단
create table public.game_players (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  team      public.team_side not null,
  position  public.position_type,
  unique (game_id, player_id)
);
comment on table public.game_players is '행이 없는 참석자 = 그 쿼터 휴식';

-- 득점 이벤트
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  minute      int check (minute is null or minute between 0 and 60),
  scorer_id   uuid not null references public.players (id) on delete restrict,
  assist_id   uuid references public.players (id) on delete set null,
  team        public.team_side not null,
  is_own_goal boolean not null default false,
  created_at  timestamptz not null default now(),
  check (assist_id is null or assist_id <> scorer_id),
  check (not is_own_goal or assist_id is null)
);
comment on table public.events is '득점 1건 = 1행. team = 득점이 올라가는 팀. 자책골이면 scorer 는 상대팀 선수';

-- 평점
create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid references public.matches (id) on delete cascade,
  game_id    uuid references public.games (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  rater_id   uuid not null references public.players (id) on delete cascade,
  score      numeric(3,1) not null check (score between 1.0 and 10.0 and (score * 2) = trunc(score * 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 모임 단위(match_id) 또는 쿼터 단위(game_id) 중 정확히 하나만
  check ((match_id is null) <> (game_id is null)),
  -- 자기 자신 평가 불가
  check (player_id <> rater_id),
  -- 같은 대상·같은 선수에게 한 번만 (NULL 도 같은 값으로 취급)
  unique nulls not distinct (match_id, game_id, player_id, rater_id)
);
comment on table public.ratings is '평점 1.0~10.0, 0.5 단위. team_settings.rating_scope 에 따라 match_id 또는 game_id 사용';

-- 출석
create table public.attendance (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  status       public.attendance_status not null,
  late_minutes int check (late_minutes is null or late_minutes >= 0),
  note         text,
  unique (match_id, player_id)
);
comment on table public.attendance is 'excused(사전통보 결석)는 출석률 분모에서 제외, absent(무단)는 포함';

-- 경기 후 한 줄 피드백 + MVP 투표
create table public.match_feedback (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  comment     text check (comment is null or char_length(comment) <= 200),
  mvp_vote_id uuid references public.players (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (match_id, player_id),
  check (comment is not null or mvp_vote_id is not null),
  check (mvp_vote_id is null or mvp_vote_id <> player_id)
);

-- 생성된 경기 보고서
create table public.match_reports (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null unique references public.matches (id) on delete cascade,
  summary_json jsonb not null,
  narrative    text,
  image_url    text,
  generated_at timestamptz not null default now()
);

-- 결산 리포트 (월말 / 분기 / 연말 / 직접 지정 기간)
-- 매 모임 기록은 그대로 쌓이고(이력), 기간 집계는 fn_player_season_stats(p_from, p_to) 로 뽑아 여기에 스냅샷 저장
create table public.period_reports (
  id           uuid primary key default gen_random_uuid(),
  period_type  public.period_type not null,
  period_start date not null,
  period_end   date not null,
  title        text not null,                 -- 예: '2026년 10월 결산', '2026년 3분기 결산', '2026 시즌 결산'
  summary_json jsonb not null,                -- 랭킹·출석·모임 수·득점 추이 등 집계 스냅샷
  narrative    text,                          -- 자동 생성 요약 문단
  image_url    text,                          -- 공유용 이미지
  generated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (period_type, period_start, period_end)
);
comment on table public.period_reports is '월말·분기·연말 결산 리포트 스냅샷. 같은 기간을 다시 생성하면 덮어쓴다(upsert)';

-- 팀 설정 (항상 1행, id = 1)
create table public.team_settings (
  id                  int primary key default 1 check (id = 1),
  team_name           text not null default 'L-FC',
  default_format      public.match_format not null default '6v6',
  default_quarter_min int not null default 12 check (default_quarter_min between 1 and 60),
  late_threshold_min  int not null default 10 check (late_threshold_min >= 0),
  rating_enabled      boolean not null default true,
  rating_scope        public.rating_scope not null default 'match',
  rating_deadline_hours int not null default 48 check (rating_deadline_hours >= 0),
  feedback_edit_hours int not null default 48 check (feedback_edit_hours >= 0),
  updated_at          timestamptz not null default now()
);
insert into public.team_settings (id) values (1);

-- updated_at 트리거
create trigger trg_tactics_updated_at        before update on public.tactics        for each row execute function public.set_updated_at();
create trigger trg_ratings_updated_at        before update on public.ratings        for each row execute function public.set_updated_at();
create trigger trg_match_feedback_updated_at before update on public.match_feedback for each row execute function public.set_updated_at();
create trigger trg_team_settings_updated_at  before update on public.team_settings  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. 인덱스 (FK 조회·정렬용)
-- ---------------------------------------------------------------------
create index idx_players_active          on public.players (is_active, name);
create index idx_matches_date            on public.matches (match_date desc);
create index idx_matches_status          on public.matches (status);
create index idx_games_match             on public.games (match_id, game_number);
create index idx_games_tactic            on public.games (tactic_id);
create index idx_game_players_game       on public.game_players (game_id);
create index idx_game_players_player     on public.game_players (player_id);
create index idx_events_game             on public.events (game_id);
create index idx_events_scorer           on public.events (scorer_id);
create index idx_events_assist           on public.events (assist_id);
create index idx_ratings_player          on public.ratings (player_id);
create index idx_ratings_match           on public.ratings (match_id);
create index idx_ratings_game            on public.ratings (game_id);
create index idx_attendance_match        on public.attendance (match_id);
create index idx_attendance_player       on public.attendance (player_id, status);
create index idx_match_feedback_match    on public.match_feedback (match_id);
create index idx_tactics_category        on public.tactics (category, is_favorite);
create index idx_period_reports_period   on public.period_reports (period_type, period_start desc);

-- ---------------------------------------------------------------------
-- 4. 집계 함수 + 뷰
--    기간 필터는 함수 파라미터(p_from, p_to)로 처리. 뷰는 전체 기간.
--    status = 'done' 인 모임만 집계한다.
-- ---------------------------------------------------------------------
create or replace function public.fn_player_season_stats(p_from date default null, p_to date default null)
returns table (
  player_id        uuid,
  name             text,
  is_active        boolean,
  matches_played   int,      -- 참석(present/late)한 모임 수
  quarters_played  int,      -- 출전 쿼터 수 (game_players 행 수)
  rest_quarters    int,      -- 참석 모임의 총 쿼터 수 - 출전 쿼터 수
  goals            int,      -- 자책골 제외
  assists          int,
  own_goals        int,
  avg_rating       numeric,  -- 평점 평균 (없으면 null)
  rating_count     int,
  attendance_rate  numeric,  -- (present+late) / (present+late+absent) * 100. excused 제외. 분모 0이면 null
  present_count    int,
  late_count       int,
  absent_count     int,
  excused_count    int,
  wins             int,      -- 출전 쿼터 기준
  draws            int,
  losses           int,
  positions_played jsonb,    -- 실제 뛴 포지션별 쿼터 수 {"GK":3,"ALA":20,...} (position 미기록 쿼터는 제외)
  main_position    public.position_type  -- 가장 많이 뛴 포지션 (동률이면 알파벳 순)
)
language sql
stable
set search_path = public
as $$
  with m as (
    select id
    from public.matches
    where status = 'done'
      and (p_from is null or match_date >= p_from)
      and (p_to   is null or match_date <= p_to)
  ),
  game_counts as (
    select g.match_id, count(*)::int as n
    from public.games g join m on m.id = g.match_id
    group by g.match_id
  ),
  att as (
    select a.player_id,
      count(*) filter (where a.status in ('present', 'late')) as matches_played,
      count(*) filter (where a.status = 'present')            as present_count,
      count(*) filter (where a.status = 'late')               as late_count,
      count(*) filter (where a.status = 'absent')             as absent_count,
      count(*) filter (where a.status = 'excused')            as excused_count,
      coalesce(sum(case when a.status in ('present', 'late') then coalesce(gc.n, 0) else 0 end), 0) as attended_quarters
    from public.attendance a
    join m on m.id = a.match_id
    left join game_counts gc on gc.match_id = a.match_id
    group by a.player_id
  ),
  gp as (
    select gp.player_id,
      count(*) as quarters_played,
      count(*) filter (where (gp.team = 'A' and g.team_a_score > g.team_b_score)
                          or (gp.team = 'B' and g.team_b_score > g.team_a_score)) as wins,
      count(*) filter (where g.team_a_score = g.team_b_score) as draws,
      count(*) filter (where (gp.team = 'A' and g.team_a_score < g.team_b_score)
                          or (gp.team = 'B' and g.team_b_score < g.team_a_score)) as losses
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    join m on m.id = g.match_id
    group by gp.player_id
  ),
  ev as (
    select e.scorer_id as player_id,
      count(*) filter (where not e.is_own_goal) as goals,
      count(*) filter (where e.is_own_goal)     as own_goals
    from public.events e
    join public.games g on g.id = e.game_id
    join m on m.id = g.match_id
    group by e.scorer_id
  ),
  ast as (
    select e.assist_id as player_id, count(*) as assists
    from public.events e
    join public.games g on g.id = e.game_id
    join m on m.id = g.match_id
    where e.assist_id is not null
    group by e.assist_id
  ),
  rt as (
    select r.player_id, round(avg(r.score), 2) as avg_rating, count(*) as rating_count
    from public.ratings r
    left join public.games g on g.id = r.game_id
    join m on m.id = coalesce(r.match_id, g.match_id)
    group by r.player_id
  ),
  pos as (
    select x.player_id,
      jsonb_object_agg(x.position, x.cnt order by x.cnt desc) as positions_played,
      (array_agg(x.position order by x.cnt desc, x.position))[1] as main_position
    from (
      select gp.player_id, gp.position, count(*)::int as cnt
      from public.game_players gp
      join public.games g on g.id = gp.game_id
      join m on m.id = g.match_id
      where gp.position is not null
      group by gp.player_id, gp.position
    ) x
    group by x.player_id
  )
  select
    p.id,
    p.name,
    p.is_active,
    coalesce(att.matches_played, 0)::int,
    coalesce(gp.quarters_played, 0)::int,
    greatest(coalesce(att.attended_quarters, 0) - coalesce(gp.quarters_played, 0), 0)::int,
    coalesce(ev.goals, 0)::int,
    coalesce(ast.assists, 0)::int,
    coalesce(ev.own_goals, 0)::int,
    rt.avg_rating,
    coalesce(rt.rating_count, 0)::int,
    case
      when coalesce(att.present_count, 0) + coalesce(att.late_count, 0) + coalesce(att.absent_count, 0) = 0 then null
      else round(
        (coalesce(att.present_count, 0) + coalesce(att.late_count, 0))::numeric
        / (coalesce(att.present_count, 0) + coalesce(att.late_count, 0) + coalesce(att.absent_count, 0)) * 100, 1)
    end,
    coalesce(att.present_count, 0)::int,
    coalesce(att.late_count, 0)::int,
    coalesce(att.absent_count, 0)::int,
    coalesce(att.excused_count, 0)::int,
    coalesce(gp.wins, 0)::int,
    coalesce(gp.draws, 0)::int,
    coalesce(gp.losses, 0)::int,
    coalesce(pos.positions_played, '{}'::jsonb),
    pos.main_position
  from public.players p
  left join att on att.player_id = p.id
  left join gp  on gp.player_id  = p.id
  left join ev  on ev.player_id  = p.id
  left join ast on ast.player_id = p.id
  left join rt  on rt.player_id  = p.id
  left join pos on pos.player_id = p.id;
$$;

-- 전체 기간 선수 통계 뷰 (security_invoker: 조회자의 RLS 적용)
create view public.v_player_season_stats
with (security_invoker = true) as
select * from public.fn_player_season_stats(null, null);

-- 모임 요약 뷰
create view public.v_match_summary
with (security_invoker = true) as
select
  m.id as match_id,
  m.match_date,
  m.start_time,
  m.venue,
  m.format,
  m.status,
  (select count(*) from public.attendance a where a.match_id = m.id and a.status in ('present', 'late'))::int as attendee_count,
  (select count(*) from public.attendance a where a.match_id = m.id and a.status = 'late')::int                 as late_count,
  (select count(*) from public.games g where g.match_id = m.id)::int                                            as game_count,
  (select coalesce(sum(g.team_a_score + g.team_b_score), 0) from public.games g where g.match_id = m.id)::int   as total_goals,
  (select count(*) filter (where g.team_a_score > g.team_b_score) from public.games g where g.match_id = m.id)::int as team_a_wins,
  (select count(*) filter (where g.team_a_score = g.team_b_score) from public.games g where g.match_id = m.id)::int as draws,
  (select count(*) filter (where g.team_a_score < g.team_b_score) from public.games g where g.match_id = m.id)::int as team_b_wins,
  -- 선수별 출전 쿼터 수 [{player_id, name, quarters}] (공평하게 돌렸는지 확인용)
  (
    select coalesce(jsonb_agg(jsonb_build_object('player_id', x.player_id, 'name', p.name, 'quarters', x.cnt) order by x.cnt desc, p.name), '[]'::jsonb)
    from (
      select gp.player_id, count(*)::int as cnt
      from public.game_players gp
      join public.games g on g.id = gp.game_id
      where g.match_id = m.id
      group by gp.player_id
    ) x
    join public.players p on p.id = x.player_id
  ) as quarters_by_player
from public.matches m;

-- 현재 로그인한 사용자와 연결된 선수 id (players.user_id 기준). 연결 안 됐으면 null
-- (players 테이블이 생성된 뒤에 정의해야 하므로 여기에 둔다)
create or replace function public.current_player_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.players where user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------
-- 5. RLS (Row Level Security, 행 단위 접근 제어)
--    - 로그인한 사용자(authenticated)는 모든 테이블 읽기 가능
--    - 기록 테이블 쓰기는 admin 만
--    - ratings / match_feedback 는 본인(연결된 선수)만 쓰기, 자기 평가 불가
-- ---------------------------------------------------------------------
alter table public.players        enable row level security;
alter table public.matches        enable row level security;
alter table public.games          enable row level security;
alter table public.game_players   enable row level security;
alter table public.events         enable row level security;
alter table public.ratings        enable row level security;
alter table public.attendance     enable row level security;
alter table public.tactics        enable row level security;
alter table public.match_feedback enable row level security;
alter table public.match_reports  enable row level security;
alter table public.team_settings  enable row level security;
alter table public.period_reports enable row level security;

-- 읽기: 로그인 사용자 전원
create policy "players_read"        on public.players        for select to authenticated using (true);
create policy "matches_read"        on public.matches        for select to authenticated using (true);
create policy "games_read"          on public.games          for select to authenticated using (true);
create policy "game_players_read"   on public.game_players   for select to authenticated using (true);
create policy "events_read"         on public.events         for select to authenticated using (true);
create policy "ratings_read"        on public.ratings        for select to authenticated using (true);
create policy "attendance_read"     on public.attendance     for select to authenticated using (true);
create policy "tactics_read"        on public.tactics        for select to authenticated using (true);
create policy "match_feedback_read" on public.match_feedback for select to authenticated using (true);
create policy "match_reports_read"  on public.match_reports  for select to authenticated using (true);
create policy "team_settings_read"  on public.team_settings  for select to authenticated using (true);
create policy "period_reports_read" on public.period_reports for select to authenticated using (true);

-- 쓰기: admin 만 (insert/update/delete)
create policy "players_admin_write"        on public.players        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "matches_admin_write"        on public.matches        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "games_admin_write"          on public.games          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "game_players_admin_write"   on public.game_players   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "events_admin_write"         on public.events         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "attendance_admin_write"     on public.attendance     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tactics_admin_write"        on public.tactics        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "match_reports_admin_write"  on public.match_reports  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "team_settings_admin_write"  on public.team_settings  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "period_reports_admin_write" on public.period_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ratings_admin_write"        on public.ratings        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "match_feedback_admin_write" on public.match_feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 평점: 본인(rater_id = 내 선수)만 작성·수정·삭제. 자기 자신 평가는 CHECK 제약으로 차단
create policy "ratings_self_insert" on public.ratings for insert to authenticated
  with check (rater_id = public.current_player_id());
create policy "ratings_self_update" on public.ratings for update to authenticated
  using (rater_id = public.current_player_id())
  with check (rater_id = public.current_player_id());
create policy "ratings_self_delete" on public.ratings for delete to authenticated
  using (rater_id = public.current_player_id());

-- 피드백: 본인(player_id = 내 선수)만 작성·수정·삭제
create policy "match_feedback_self_insert" on public.match_feedback for insert to authenticated
  with check (player_id = public.current_player_id());
create policy "match_feedback_self_update" on public.match_feedback for update to authenticated
  using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());
create policy "match_feedback_self_delete" on public.match_feedback for delete to authenticated
  using (player_id = public.current_player_id());

-- ---------------------------------------------------------------------
-- 6. 권한 부여 (Supabase 기본값과 같지만 명시). 실제 행 접근은 위 RLS 정책이 결정한다
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
