-- =====================================================================
-- 가상(연습용) 데이터 정리
-- seed.sql 로 넣은 가상 선수 15명과 가상 모임·쿼터·득점·평점·출석·피드백을 지운다.
-- 앱에서 직접 등록한 실제 선수와, 대표 계정으로 만든 모임(created_by 가 있는 것)은 남는다.
-- Supabase SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전.
-- =====================================================================

begin;

-- 1) 가상 모임 삭제 (seed 는 created_by 가 비어 있음) → 쿼터·편성·득점·평점·출석·피드백·보고서가 함께(cascade) 삭제됨
delete from public.matches where created_by is null;

-- 2) 가상 선수 15명 삭제 (이름 기준). 남은 기록이 있으면 restrict 로 막히므로 1)을 먼저 실행해야 함
delete from public.players
where name in ('김민준','이서준','박도윤','최예준','정시우','강하준','조주원','윤지호',
               '임건우','한현우','오우진','서선우','신재민','류태양','문승현')
  and user_id is null;

-- 3) 가상 전술 2개도 지우려면 아래 줄의 주석(--)을 지우고 실행
-- delete from public.tactics where name in ('기본 2-1-2', '코너킥 니어포스트');

commit;

-- 확인
select
  (select count(*) from public.players)  as players_left,
  (select count(*) from public.matches)  as matches_left,
  (select count(*) from public.games)    as games_left,
  (select string_agg(name, ', ' order by name) from public.players) as player_names;
