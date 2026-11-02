-- =====================================================================
-- 0002: 오픈형 접근 정책 + 역할 3단계
--   - (로그인 없음) 팀원  : 조회, 참석 응답, 평점, 피드백 — 앱에서 고른 "내 이름"으로 기록
--   - scorer  (lfc3)      : 경기 중 입력 — 모임 생성, 쿼터·편성, 득점, 출석 확정
--   - admin   (lfc1, lfc2): 위 전부 + 선수 등록·수정, 전술, 보고서, 팀 설정
-- 역할은 auth.users.app_metadata.role 에 'admin' / 'scorer' 로 저장 (아래 set_user_role 참고)
-- 자기 자신 평가 금지, 0.5 단위, 1인 1회 등은 DB 제약으로 계속 보장된다.
-- =====================================================================

-- 0) 역할 함수
-- scorer 이상(= scorer 또는 admin)인가?
create or replace function public.is_scorer()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'scorer'), false);
$$;

-- 계정에 역할 부여 (SQL Editor 에서 postgres 권한으로만 실행 가능. 앱에서는 호출 불가)
--   select public.set_user_role('lfc1@lfc.team', 'admin');
--   select public.set_user_role('lfc3@lfc.team', 'scorer');
--   select public.set_user_role('lfc3@lfc.team', null);   -- 역할 제거
create or replace function public.set_user_role(p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_role is not null and p_role not in ('admin', 'scorer') then
    raise exception '역할은 admin, scorer 중 하나여야 합니다: %', p_role;
  end if;
  update auth.users
  set raw_app_meta_data =
    case when p_role is null
      then coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
      else coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role)
    end
  where email = p_email;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception '해당 이메일의 계정이 없습니다: % (Authentication → Users 에서 먼저 만드세요)', p_email;
  end if;
  return format('%s → %s', p_email, coalesce(p_role, '(없음)'));
end;
$$;
revoke execute on function public.set_user_role(text, text) from public, anon, authenticated;

-- 경기 기록 테이블 쓰기: admin → scorer 이상으로 완화
drop policy if exists "matches_admin_write"      on public.matches;
drop policy if exists "games_admin_write"        on public.games;
drop policy if exists "game_players_admin_write" on public.game_players;
drop policy if exists "events_admin_write"       on public.events;
drop policy if exists "attendance_admin_write"   on public.attendance;
create policy "matches_scorer_write"      on public.matches      for all to authenticated using (public.is_scorer()) with check (public.is_scorer());
create policy "games_scorer_write"        on public.games        for all to authenticated using (public.is_scorer()) with check (public.is_scorer());
create policy "game_players_scorer_write" on public.game_players for all to authenticated using (public.is_scorer()) with check (public.is_scorer());
create policy "events_scorer_write"       on public.events       for all to authenticated using (public.is_scorer()) with check (public.is_scorer());
create policy "attendance_scorer_write"   on public.attendance   for all to authenticated using (public.is_scorer()) with check (public.is_scorer());
-- players / tactics / match_reports / period_reports / team_settings 는 0001 의 admin 정책 유지

-- 1) 읽기 정책을 anon 까지 확장
drop policy if exists "players_read"        on public.players;
drop policy if exists "matches_read"        on public.matches;
drop policy if exists "games_read"          on public.games;
drop policy if exists "game_players_read"   on public.game_players;
drop policy if exists "events_read"         on public.events;
drop policy if exists "ratings_read"        on public.ratings;
drop policy if exists "attendance_read"     on public.attendance;
drop policy if exists "tactics_read"        on public.tactics;
drop policy if exists "match_feedback_read" on public.match_feedback;
drop policy if exists "match_reports_read"  on public.match_reports;
drop policy if exists "period_reports_read" on public.period_reports;
drop policy if exists "team_settings_read"  on public.team_settings;

create policy "players_read"        on public.players        for select to anon, authenticated using (true);
create policy "matches_read"        on public.matches        for select to anon, authenticated using (true);
create policy "games_read"          on public.games          for select to anon, authenticated using (true);
create policy "game_players_read"   on public.game_players   for select to anon, authenticated using (true);
create policy "events_read"         on public.events         for select to anon, authenticated using (true);
create policy "ratings_read"        on public.ratings        for select to anon, authenticated using (true);
create policy "attendance_read"     on public.attendance     for select to anon, authenticated using (true);
create policy "tactics_read"        on public.tactics        for select to anon, authenticated using (true);
create policy "match_feedback_read" on public.match_feedback for select to anon, authenticated using (true);
create policy "match_reports_read"  on public.match_reports  for select to anon, authenticated using (true);
create policy "period_reports_read" on public.period_reports for select to anon, authenticated using (true);
create policy "team_settings_read"  on public.team_settings  for select to anon, authenticated using (true);

-- 2) "계정 ↔ 선수 연결" 기반 본인 정책 제거 (오픈형에서는 쓰지 않음)
drop policy if exists "ratings_self_insert"        on public.ratings;
drop policy if exists "ratings_self_update"        on public.ratings;
drop policy if exists "ratings_self_delete"        on public.ratings;
drop policy if exists "match_feedback_self_insert" on public.match_feedback;
drop policy if exists "match_feedback_self_update" on public.match_feedback;
drop policy if exists "match_feedback_self_delete" on public.match_feedback;

-- 3) 평점: 누구나 (rater 는 활성 선수)
create policy "ratings_member_insert" on public.ratings
  for insert to anon, authenticated
  with check (exists (select 1 from public.players p where p.id = rater_id and p.is_active));
create policy "ratings_member_update" on public.ratings
  for update to anon, authenticated
  using (true)
  with check (exists (select 1 from public.players p where p.id = rater_id and p.is_active));
create policy "ratings_member_delete" on public.ratings
  for delete to anon, authenticated
  using (true);

-- 4) 피드백: 누구나 (작성자는 활성 선수)
create policy "match_feedback_member_insert" on public.match_feedback
  for insert to anon, authenticated
  with check (exists (select 1 from public.players p where p.id = player_id and p.is_active));
create policy "match_feedback_member_update" on public.match_feedback
  for update to anon, authenticated
  using (true)
  with check (exists (select 1 from public.players p where p.id = player_id and p.is_active));
create policy "match_feedback_member_delete" on public.match_feedback
  for delete to anon, authenticated
  using (true);

-- 5) 참석/불참 응답: 예정(scheduled) 모임에 한해 누구나, present/excused 만
--    모임이 done 이 되면 admin 만 수정 가능 (지각/결석 확정은 대표 몫)
--    출석률 집계는 status='done' 모임만 보므로 응답이 통계를 오염시키지 않는다
create policy "attendance_member_rsvp_insert" on public.attendance
  for insert to anon, authenticated
  with check (
    status in ('present', 'excused')
    and exists (select 1 from public.players p where p.id = player_id and p.is_active)
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled')
  );
create policy "attendance_member_rsvp_update" on public.attendance
  for update to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled'))
  with check (
    status in ('present', 'excused')
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'scheduled')
  );

-- 6) anon 역할 권한 (Supabase 기본값과 같지만 명시)
grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
grant execute on all functions in schema public to anon;
