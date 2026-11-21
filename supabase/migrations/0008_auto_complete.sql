-- 0008: 지난 모임 자동 완료
--   날짜가 지난(한국 시간 기준 어제 이전) "예정" 모임 중 기록(쿼터 또는 당일 출석)이 있으면 자동으로 '완료'(done) 처리한다.
--   완료되는 모임에서 당일 출석을 안 적었다면, 쿼터에 한 번이라도 출전한 선수를 '출석'(present) 으로 채운다.
--   앱이 경기 목록·홈·통계를 열 때마다 이 함수를 호출한다 (로그인 없이도 호출 가능, security definer).
--   기록이 전혀 없는 지난 예정 모임은 그대로 두어 대표가 '취소' 또는 '완료'를 직접 고른다.

create or replace function public.fn_auto_complete_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(m.id), '{}') into v_ids
  from public.matches m
  where m.status = 'scheduled'
    and m.match_date < (now() at time zone 'Asia/Seoul')::date
    and (
      exists (select 1 from public.games g where g.match_id = m.id)
      or exists (select 1 from public.attendance a where a.match_id = m.id and a.status is not null)
    );

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return 0;
  end if;

  -- 쿼터에 출전했는데 당일 출석이 비어 있으면 '출석'으로 채움 (투표만 한 행은 갱신, 행이 없으면 추가)
  insert into public.attendance (match_id, player_id, status)
  select distinct g.match_id, gp.player_id, 'present'::public.attendance_status
  from public.games g
  join public.game_players gp on gp.game_id = g.id
  where g.match_id = any (v_ids)
  on conflict (match_id, player_id) do update
    set status = excluded.status
    where attendance.status is null;

  update public.matches set status = 'done' where id = any (v_ids);
  return array_length(v_ids, 1);
end;
$$;

revoke all on function public.fn_auto_complete_matches() from public;
grant execute on function public.fn_auto_complete_matches() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
