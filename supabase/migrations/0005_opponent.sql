-- =====================================================================
-- 0005: 상대팀 경기 모드
--   matches.opponent  : 상대팀 이름. null 이면 자체전(A팀 vs B팀), 값이 있으면 우리(A) vs 상대(B)
--   events.scorer_id  : 실점(상대 득점)은 득점자 없이 기록할 수 있게 nullable
-- 집계: 실점(scorer null)은 누구의 골/자책골로도 세지 않는다. 승/무/패는 A/B 스코어 그대로.
-- =====================================================================

alter table public.matches add column if not exists opponent text check (opponent is null or char_length(opponent) <= 40);
comment on column public.matches.opponent is '상대팀 이름. null = 자체전. 있으면 A = 우리, B = 상대';

alter table public.events alter column scorer_id drop not null;
-- 자체전(A/B 모두 우리 선수)에서는 득점자가 반드시 있어야 한다 → 트리거로 검사
create or replace function public.check_event_scorer()
returns trigger
language plpgsql
as $$
declare
  v_opponent text;
begin
  if new.scorer_id is null then
    select m.opponent into v_opponent from public.games g join public.matches m on m.id = g.match_id where g.id = new.game_id;
    if v_opponent is null then
      raise exception '자체전에서는 득점자를 지정해야 합니다';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_events_scorer_check on public.events;
create trigger trg_events_scorer_check before insert or update on public.events for each row execute function public.check_event_scorer();

-- 모임 요약 뷰에 상대팀 이름 추가 (맨 뒤 컬럼 추가 → create or replace 가능)
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
  (select count(*) from public.attendance a where a.match_id = m.id and a.rsvp = 'no')::int  as rsvp_no_count,
  m.opponent,
  (select coalesce(sum(g.team_a_score), 0) from public.games g where g.match_id = m.id)::int as team_a_goals,
  (select coalesce(sum(g.team_b_score), 0) from public.games g where g.match_id = m.id)::int as team_b_goals
from public.matches m;

grant select on public.v_match_summary to anon, authenticated, service_role;
