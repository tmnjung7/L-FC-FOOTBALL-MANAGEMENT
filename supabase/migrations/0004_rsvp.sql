-- =====================================================================
-- 0004: 사전 투표(RSVP)와 당일 출석을 분리
--   attendance.rsvp   : 'yes' | 'no' | null  — 경기 3~4일 전 카톡 투표 결과 (누가 오는지)
--   attendance.status : present/late/absent/excused | null — 당일 확정 (출석/지각/결석/사전통보)
-- 둘 중 하나는 반드시 있어야 한다. 출석률 집계는 status 만 본다.
-- 노쇼 = rsvp='yes' 인데 status='absent'
-- =====================================================================

alter table public.attendance add column if not exists rsvp text check (rsvp in ('yes', 'no'));
alter table public.attendance alter column status drop not null;
alter table public.attendance drop constraint if exists attendance_rsvp_or_status;
alter table public.attendance add constraint attendance_rsvp_or_status check (status is not null or rsvp is not null);

-- 기존 데이터 이전: 예정 모임의 present/excused 는 앱의 참석/불참 응답이었으므로 투표로 옮긴다
update public.attendance a
set rsvp = case a.status when 'present' then 'yes' when 'excused' then 'no' end,
    status = null
from public.matches m
where m.id = a.match_id and m.status = 'scheduled' and a.status in ('present', 'excused');

-- 팀원(로그인 없음) 투표 정책: 예정 모임에 한해 rsvp 만 쓰기 (당일 status 는 대표만)
drop policy if exists "attendance_member_rsvp_insert" on public.attendance;
drop policy if exists "attendance_member_rsvp_update" on public.attendance;
create policy "attendance_member_rsvp_insert" on public.attendance
  for insert to anon, authenticated
  with check (
    rsvp is not null and status is null
    and exists (select 1 from public.players p where p.id = player_id and p.is_active)
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled')
  );
create policy "attendance_member_rsvp_update" on public.attendance
  for update to anon, authenticated
  using (
    status is null
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled')
  )
  with check (
    rsvp is not null and status is null
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled')
  );

-- 모임 요약 뷰: 투표 집계 컬럼 추가 (뒤에 추가하므로 create or replace 가능)
create or replace view public.v_match_summary
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
  ) as quarters_by_player,
  (select count(*) from public.attendance a where a.match_id = m.id and a.rsvp = 'yes')::int as rsvp_yes_count,
  (select count(*) from public.attendance a where a.match_id = m.id and a.rsvp = 'no')::int  as rsvp_no_count
from public.matches m;

-- 선수 통계: 노쇼 횟수 추가 (반환 형태가 바뀌므로 뷰 → 함수 순으로 다시 만든다)
drop view if exists public.v_player_season_stats;
drop function if exists public.fn_player_season_stats(date, date);

create or replace function public.fn_player_season_stats(p_from date default null, p_to date default null)
returns table (
  player_id        uuid,
  name             text,
  is_active        boolean,
  matches_played   int,
  quarters_played  int,
  rest_quarters    int,
  goals            int,
  assists          int,
  own_goals        int,
  avg_rating       numeric,
  rating_count     int,
  attendance_rate  numeric,
  present_count    int,
  late_count       int,
  absent_count     int,
  excused_count    int,
  wins             int,
  draws            int,
  losses           int,
  positions_played jsonb,
  main_position    public.position_type,
  no_show_count    int   -- 투표는 참석인데 당일 무단 결석
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
      count(*) filter (where a.rsvp = 'yes' and a.status = 'absent') as no_show_count,
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
    pos.main_position,
    coalesce(att.no_show_count, 0)::int
  from public.players p
  left join att on att.player_id = p.id
  left join gp  on gp.player_id  = p.id
  left join ev  on ev.player_id  = p.id
  left join ast on ast.player_id = p.id
  left join rt  on rt.player_id  = p.id
  left join pos on pos.player_id = p.id;
$$;

create view public.v_player_season_stats
with (security_invoker = true) as
select * from public.fn_player_season_stats(null, null);

grant select on public.v_player_season_stats, public.v_match_summary to anon, authenticated, service_role;
grant execute on function public.fn_player_season_stats(date, date) to anon, authenticated, service_role;
