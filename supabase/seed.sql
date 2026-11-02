-- =====================================================================
-- 더미 데이터 시드 (seed.sql)
-- 0001_init.sql 실행 후 Supabase SQL Editor 에 붙여넣고 Run.
-- 실제 사람 이름이 아닌 가상 이름만 사용. 운영 전에는 아래 "초기화" 블록으로 전부 지울 수 있다.
--
-- 내용: 선수 15명(활성 14 + 비활성 1), 일요일 모임 8회(2026-09-13 ~ 2026-11-01), 모임당 9쿼터(총 72쿼터)
--       쿼터마다 출전 명단이 바뀜, 득점/어시스트 이벤트, 모임 단위 평점, 출석, 피드백, 전술 2개
-- 재실행하면 같은 결과가 나오도록 난수 시드를 고정한다 (setseed).
-- =====================================================================

-- 초기화 (기존 더미 데이터 제거). 운영 데이터가 있다면 이 줄들을 지우고 실행할 것!
truncate table public.period_reports, public.match_reports, public.match_feedback, public.ratings,
               public.events, public.game_players, public.games, public.attendance,
               public.matches, public.tactics, public.players
  restart identity cascade;

select setseed(0.42);

do $$
declare
  v_players  uuid[];
  v_names    text[] := array['김민준','이서준','박도윤','최예준','정시우','강하준','조주원','윤지호','임건우','한현우','오우진','서선우','신재민','류태양','문승현'];
  v_pos      public.position_type[] := array['GK','FIXO','ALA','ALA','PIVO','ANY','GK','FIXO','ALA','PIVO','ANY','ALA','FIXO','PIVO','ANY'];
  v_dates    date[] := array['2026-09-13','2026-09-20','2026-09-27','2026-10-04','2026-10-11','2026-10-18','2026-10-25','2026-11-01'];
  v_venues   text[] := array['한강 풋살파크 A구장','강남 실내풋살장 2면','한강 풋살파크 A구장','성수 루프탑 풋살장'];
  v_comments text[] := array[
    '오늘 압박이 잘 됐다. 다음엔 세트피스 연습하자',
    '후반 체력이 떨어졌다. 교대 더 자주 하면 좋겠음',
    '골키퍼 선방 덕에 살았다',
    '패스 템포가 너무 느렸음. 원터치 연습 필요',
    '팀 밸런스 좋았음. 이대로 가자',
    '지각 좀 줄입시다…',
    '코너킥 패턴 하나 만들어 보자',
    '오늘 날씨 최고. 경기도 재밌었다'
  ];
  v_tactic_1 uuid;
  v_tactic_2 uuid;

  v_match_id   uuid;
  v_game_id    uuid;
  v_attendees  uuid[];
  v_attendee_n int;
  v_format     public.match_format;
  v_per_team   int;
  v_lineup     uuid[];
  v_team_a     uuid[];
  v_team_b     uuid[];
  v_i int; v_g int; v_k int; v_goals_a int; v_goals_b int;
  v_scorer uuid; v_assist uuid; v_r numeric;
  v_pid uuid; v_rater uuid; v_target uuid;
  v_mvp uuid;
begin
  -- 1) 선수 15명 (실제 팀원 수 기준)
  for v_i in 1..15 loop
    insert into public.players (name, preferred_position, jersey_number, is_active, joined_at)
    values (v_names[v_i], v_pos[v_i], v_i + 1, v_i <> 15, date '2025-03-02' + (v_i * 7))
    returning id into v_pid;
    v_players := array_append(v_players, v_pid);
  end loop;
  -- 15번째 선수는 비활성(초반 2회만 참석)으로 두어 "비활성 섹션" 테스트에 사용

  -- 2) 전술 2개 (board_json 은 4단계 포맷의 최소 예시)
  insert into public.tactics (name, format, category, description, board_json, is_favorite)
  values (
    '기본 2-1-2', '6v6', 'formation', 'GK 1 + 수비 2 + 중앙 1 + 공격 2. 수비 시 2-3 블록으로 전환.',
    '{"version":1,"format":"6v6","orientation":"vertical",
      "markers":[
        {"id":"p1","kind":"us","x":0.5,"y":0.92,"label":"GK","playerId":null},
        {"id":"p2","kind":"us","x":0.3,"y":0.72,"label":"LD","playerId":null},
        {"id":"p3","kind":"us","x":0.7,"y":0.72,"label":"RD","playerId":null},
        {"id":"p4","kind":"us","x":0.5,"y":0.55,"label":"MF","playerId":null},
        {"id":"p5","kind":"us","x":0.3,"y":0.35,"label":"LF","playerId":null},
        {"id":"p6","kind":"us","x":0.7,"y":0.35,"label":"RF","playerId":null},
        {"id":"ball","kind":"ball","x":0.5,"y":0.5,"label":"","playerId":null}
      ],
      "arrows":[],"zones":[],"notes":[],"frames":[]}'::jsonb,
    true
  ) returning id into v_tactic_1;

  insert into public.tactics (name, format, category, description, board_json, is_favorite)
  values (
    '코너킥 니어포스트', '6v6', 'set_piece', '키커가 니어포스트로 짧게, 피보가 스크린 후 뒷공간 침투.',
    '{"version":1,"format":"6v6","orientation":"vertical",
      "markers":[
        {"id":"p1","kind":"us","x":0.5,"y":0.92,"label":"GK","playerId":null},
        {"id":"p2","kind":"us","x":0.98,"y":0.02,"label":"K","playerId":null},
        {"id":"p3","kind":"us","x":0.7,"y":0.12,"label":"P","playerId":null},
        {"id":"p4","kind":"us","x":0.5,"y":0.2,"label":"A","playerId":null},
        {"id":"p5","kind":"us","x":0.35,"y":0.25,"label":"A","playerId":null},
        {"id":"p6","kind":"us","x":0.5,"y":0.45,"label":"F","playerId":null},
        {"id":"ball","kind":"ball","x":0.98,"y":0.02,"label":"","playerId":null}
      ],
      "arrows":[{"id":"a1","from":[0.98,0.02],"to":[0.7,0.12],"style":"pass"},{"id":"a2","from":[0.5,0.2],"to":[0.62,0.08],"style":"move"}],
      "zones":[],"notes":[{"id":"n1","x":0.15,"y":0.1,"text":"스크린 후 침투"}],"frames":[]}'::jsonb,
    false
  ) returning id into v_tactic_2;

  -- 3) 모임 8회
  for v_i in 1..8 loop
    -- 3-1) 출석: 활성 선수 14명 + 비활성 1명(초반 2회만 참석)
    v_attendees := array[]::uuid[];
    insert into public.matches (match_date, start_time, venue, format, status, notes)
    values (v_dates[v_i], time '10:00', v_venues[((v_i - 1) % 4) + 1], '6v6', 'done',
            case when v_i = 8 then '시즌 마지막 모임 전 리허설' else null end)
    returning id into v_match_id;

    for v_k in 1..15 loop
      v_pid := v_players[v_k];
      v_r := random();
      if v_k = 15 then
        -- 비활성 선수: 1~2회차만 출석, 이후 사전통보 결석
        if v_i <= 2 then
          insert into public.attendance (match_id, player_id, status) values (v_match_id, v_pid, 'present');
          v_attendees := array_append(v_attendees, v_pid);
        else
          insert into public.attendance (match_id, player_id, status, note) values (v_match_id, v_pid, 'excused', '당분간 불참');
        end if;
      elsif v_r < 0.72 then
        insert into public.attendance (match_id, player_id, status) values (v_match_id, v_pid, 'present');
        v_attendees := array_append(v_attendees, v_pid);
      elsif v_r < 0.86 then
        insert into public.attendance (match_id, player_id, status, late_minutes)
        values (v_match_id, v_pid, 'late', 5 + floor(random() * 25)::int);
        v_attendees := array_append(v_attendees, v_pid);
      elsif v_r < 0.94 then
        insert into public.attendance (match_id, player_id, status, note) values (v_match_id, v_pid, 'excused', '사전 통보');
      else
        insert into public.attendance (match_id, player_id, status) values (v_match_id, v_pid, 'absent');
      end if;
    end loop;

    v_attendee_n := coalesce(array_length(v_attendees, 1), 0);
    -- 참석 12명 이상이면 6v6(나머지는 쿼터마다 교대로 휴식), 그 미만이면 5v5
    if v_attendee_n >= 12 then v_format := '6v6'; v_per_team := 6;
    else v_format := '5v5'; v_per_team := least(5, v_attendee_n / 2);
    end if;
    update public.matches set format = v_format where id = v_match_id;

    -- 3-2) 쿼터 9개
    for v_g in 1..9 loop
      insert into public.games (match_id, game_number, duration_min, tactic_id)
      values (v_match_id, v_g, case when v_format = '6v6' then 12 else 10 end,
              case when v_g % 3 = 1 then v_tactic_1 when v_g % 4 = 0 then v_tactic_2 else null end)
      returning id into v_game_id;

      -- 참석자를 무작위로 섞어 앞에서부터 A팀, B팀, 나머지는 휴식
      select array_agg(x order by random()) into v_lineup from unnest(v_attendees) as x;
      v_team_a := v_lineup[1 : v_per_team];
      v_team_b := v_lineup[v_per_team + 1 : v_per_team * 2];

      -- 포지션: 첫 번째는 GK, 나머지는 선호 포지션(70%) 또는 FIXO/ALA/PIVO 중 무작위
      insert into public.game_players (game_id, player_id, team, position)
      select v_game_id, t.x, 'A',
        case when t.ord = 1 then 'GK'::public.position_type
             when p.preferred_position in ('FIXO','ALA','PIVO') and random() < 0.7 then p.preferred_position
             else (array['FIXO','ALA','PIVO']::public.position_type[])[1 + floor(random() * 3)::int] end
      from unnest(v_team_a) with ordinality as t(x, ord) join public.players p on p.id = t.x;
      insert into public.game_players (game_id, player_id, team, position)
      select v_game_id, t.x, 'B',
        case when t.ord = 1 then 'GK'::public.position_type
             when p.preferred_position in ('FIXO','ALA','PIVO') and random() < 0.7 then p.preferred_position
             else (array['FIXO','ALA','PIVO']::public.position_type[])[1 + floor(random() * 3)::int] end
      from unnest(v_team_b) with ordinality as t(x, ord) join public.players p on p.id = t.x;

      -- 3-3) 득점 이벤트: 팀별 0~3골, 어시스트 60%, 자책골 6%
      v_goals_a := floor(random() * 4)::int;
      v_goals_b := floor(random() * 4)::int;

      for v_k in 1..v_goals_a loop
        if random() < 0.06 then
          -- A팀 득점이지만 B팀 선수의 자책골
          v_scorer := v_team_b[1 + floor(random() * array_length(v_team_b, 1))::int];
          insert into public.events (game_id, minute, scorer_id, assist_id, team, is_own_goal)
          values (v_game_id, 1 + floor(random() * 12)::int, v_scorer, null, 'A', true);
        else
          v_scorer := v_team_a[1 + floor(random() * array_length(v_team_a, 1))::int];
          v_assist := null;
          if random() < 0.6 then
            select x into v_assist from unnest(v_team_a) as x where x <> v_scorer order by random() limit 1;
          end if;
          insert into public.events (game_id, minute, scorer_id, assist_id, team, is_own_goal)
          values (v_game_id, 1 + floor(random() * 12)::int, v_scorer, v_assist, 'A', false);
        end if;
      end loop;

      for v_k in 1..v_goals_b loop
        if random() < 0.06 then
          v_scorer := v_team_a[1 + floor(random() * array_length(v_team_a, 1))::int];
          insert into public.events (game_id, minute, scorer_id, assist_id, team, is_own_goal)
          values (v_game_id, 1 + floor(random() * 12)::int, v_scorer, null, 'B', true);
        else
          v_scorer := v_team_b[1 + floor(random() * array_length(v_team_b, 1))::int];
          v_assist := null;
          if random() < 0.6 then
            select x into v_assist from unnest(v_team_b) as x where x <> v_scorer order by random() limit 1;
          end if;
          insert into public.events (game_id, minute, scorer_id, assist_id, team, is_own_goal)
          values (v_game_id, 1 + floor(random() * 12)::int, v_scorer, v_assist, 'B', false);
        end if;
      end loop;

      -- 스코어는 이벤트 수와 반드시 일치하도록 이벤트에서 계산해 기록
      update public.games g set
        team_a_score = (select count(*) from public.events e where e.game_id = g.id and e.team = 'A'),
        team_b_score = (select count(*) from public.events e where e.game_id = g.id and e.team = 'B')
      where g.id = v_game_id;
    end loop;

    -- 3-4) 평점 (모임 단위): 참석자 각자가 다른 참석자를 55% 확률로 평가, 5.0~9.5 (0.5 단위)
    foreach v_rater in array v_attendees loop
      foreach v_target in array v_attendees loop
        if v_rater <> v_target and random() < 0.55 then
          insert into public.ratings (match_id, game_id, player_id, rater_id, score)
          values (v_match_id, null, v_target, v_rater, 5.0 + floor(random() * 10)::int * 0.5);
        end if;
      end loop;
    end loop;

    -- 3-5) 피드백 + MVP 투표: 참석자의 60%
    foreach v_pid in array v_attendees loop
      if random() < 0.6 then
        select x into v_mvp from unnest(v_attendees) as x where x <> v_pid order by random() limit 1;
        insert into public.match_feedback (match_id, player_id, comment, mvp_vote_id)
        values (v_match_id, v_pid, v_comments[1 + floor(random() * 8)::int], v_mvp);
      end if;
    end loop;
  end loop;

  -- 4) 다음 주 모임 (예정) 1개 — 홈 화면 "다음 모임 카드" 테스트용
  insert into public.matches (match_date, start_time, venue, format, status)
  values ('2026-11-08', time '10:00', '한강 풋살파크 A구장', '6v6', 'scheduled');
end $$;

-- 팀 설정 기본값
update public.team_settings
set team_name = 'L-FC', default_format = '6v6', default_quarter_min = 12, late_threshold_min = 10,
    rating_enabled = true, rating_scope = 'match'
where id = 1;

-- 확인용 요약
select
  (select count(*) from public.players)        as players,
  (select count(*) from public.matches)        as matches,
  (select count(*) from public.games)          as games,
  (select count(*) from public.game_players)   as game_players,
  (select count(*) from public.events)         as events,
  (select count(*) from public.ratings)        as ratings,
  (select count(*) from public.attendance)     as attendance,
  (select count(*) from public.match_feedback) as feedback,
  (select count(*) from public.tactics)        as tactics;
