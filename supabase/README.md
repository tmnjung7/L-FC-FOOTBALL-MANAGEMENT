# Supabase 적용 안내 (2단계)

이 폴더에는 데이터베이스 구조(스키마)와 더미 데이터가 들어 있습니다.

| 파일 | 내용 |
|---|---|
| `migrations/0001_init.sql` | 테이블 12개, ENUM 8개, 집계 함수·뷰 2개, RLS(행 단위 권한) 정책, 인덱스 |
| `seed.sql` | 가상 이름 선수 15명, 일요일 모임 8회 × 9쿼터, 득점·평점·출석·피드백·전술 더미 데이터 |

> 올리기 전에 내 컴퓨터에서 먼저 검증할 수 있습니다: `pnpm db:check`
> (설치 없이 PostgreSQL을 메모리에 띄워 두 파일을 실행하고, 집계·권한이 맞는지 확인합니다)

## 1. 스키마 적용 (처음 1회)

1. Supabase 대시보드 → 왼쪽 메뉴 **SQL Editor** → **New query**
2. `migrations/0001_init.sql` 파일을 열어 **전체 복사** → 편집기에 붙여넣기 → **Run** (오른쪽 아래 초록 버튼, 또는 Ctrl/Cmd+Enter)
3. 아래쪽에 `Success. No rows returned` 가 뜨면 성공
4. 왼쪽 메뉴 **Table Editor** 에서 표 12개가 보이는지 확인:
   `players, matches, games, game_players, events, ratings, attendance, tactics, match_feedback, match_reports, period_reports, team_settings`
5. **Database → Views** (또는 Table Editor 의 schema 선택에서 views) 에 `v_player_season_stats`, `v_match_summary` 2개가 보이면 완료

## 2. 더미 데이터 넣기 (개발 중에만)

1. SQL Editor → New query → `seed.sql` 전체 붙여넣기 → Run
2. 맨 아래 결과 표에 `players 15, matches 9, games 72 …` 처럼 건수가 나오면 성공
3. Table Editor → `players` 에 가상 이름 15명이 보이면 OK

⚠️ `seed.sql` 맨 위에는 **기존 데이터를 전부 지우는 `truncate` 문**이 있습니다.
실제 팀 기록을 입력하기 시작한 뒤에는 절대 다시 실행하지 마세요. (운영 전환 시 한 번만 실행해 더미를 비우고 끝)

## 3. 관리자(admin) 지정 (3단계 로그인 붙일 때 필요)

앱에서 한 번 로그인(매직 링크)해 `auth.users` 에 내 계정이 생긴 뒤, SQL Editor 에서:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = '내이메일@example.com';
```

적용 후 앱에서 **로그아웃 → 다시 로그인**해야 권한이 반영됩니다. (권한 정보가 로그인 토큰에 들어가기 때문)

## 4. 내 계정과 선수 연결 (평점·피드백 입력에 필요)

```sql
update public.players
set user_id = (select id from auth.users where email = '내이메일@example.com')
where name = '내 선수 이름';
```

3단계에서 설정 화면에 "초대 링크 + 선수 연결" 기능이 들어가면 SQL 없이 할 수 있게 됩니다.

## 5. 구조 설명 — 왜 이렇게 나눴나

### matches(모임) 와 games(쿼터) 를 분리한 이유
우리 모임은 일요일 하루에 8~10쿼터를 돌리고, **쿼터마다 팀 A/B 편성과 출전 선수가 바뀝니다.**
"일요일 모임" 한 덩어리로만 저장하면 다음이 불가능합니다.
- 누가 몇 쿼터 뛰고 몇 쿼터 쉬었는지 (공평한 출전 확인)
- 어느 쿼터에 누가 골을 넣었고 그때 같은 팀이 누구였는지 (승/무/패 집계)
- 쿼터별 스코어와 사용한 전술

그래서 `matches`(날짜·장소·출석)는 하루 단위, `games`(스코어·시간·전술)는 쿼터 단위로 두고,
개인 기록(`game_players`, `events`)은 모두 쿼터에 매답니다. 평점만 "그날 전체 1회"가 기본이라 `ratings.match_id` 를 씁니다.

### 각 테이블의 역할
| 테이블 | 왜 필요한가 |
|---|---|
| `players` | 선수 명단. 이름·선호 포지션·활동 여부. 삭제 대신 비활성화(기록 보존). 회원 추가는 여기에 행 추가 |
| `matches` | 모임(경기일). 날짜·장소·형식·상태 |
| `games` | 모임 안의 쿼터. 스코어·시간·전술. 스코어는 events 건수와 항상 일치해야 함 |
| `game_players` | 쿼터별 출전 명단 + **실제 뛴 포지션**. 행이 없으면 그 쿼터 휴식. 포지션별 출전 통계의 원천 |
| `events` | 득점 1건 = 1행. 어시스트는 같은 행. 자책골은 scorer 가 상대팀 선수 |
| `ratings` | 평점. 모임 단위(match_id) 또는 쿼터 단위(game_id) 중 하나만. 자기 평가 불가, 0.5 단위 |
| `attendance` | 출석/지각/결석/사전통보. 사전통보는 출석률 분모에서 제외 |
| `tactics` | 전술판 저장(board_json). 좌표는 0~1 비율 |
| `match_feedback` | 경기 후 한 줄 피드백 + MVP 투표. 모임당 1인 1회 |
| `match_reports` | 그날 경기 보고서 스냅샷 (4-2단계) |
| `period_reports` | **월말·분기·연말 결산 리포트** 스냅샷. 모든 기록은 그대로 쌓이고, 기간 집계는 `fn_player_season_stats(from, to)` 로 뽑아 저장 |
| `team_settings` | 팀 이름, 기본 형식, 지각 기준, 평점 on/off 등 (1행) |

### 집계
- `fn_player_season_stats(p_from, p_to)` — 선수별 집계 함수. 기간을 주면 그 기간만 (월간/분기/연간 결산에 사용). `null, null` 이면 전체
- `v_player_season_stats` — 위 함수의 전체 기간 뷰 (통계 화면 기본)
- `v_match_summary` — 모임별 참석 인원·쿼터 수·총 득점·A팀 승무패·선수별 출전 쿼터 수
- 집계 항목: 참석 모임 수, 출전/휴식 쿼터, 골, 어시, 자책골, 평균 평점(평가 수), 출석률, 지각/결석 수, 승/무/패, **포지션별 출전 쿼터 수와 주 포지션**

### 권한(RLS)
- 로그인한 사람은 전부 읽기 가능
- 기록 입력(선수·모임·쿼터·득점·출석·전술·보고서·설정)은 admin 만
- 평점·피드백은 "내 계정에 연결된 선수" 본인만 쓰기, 자기 자신 평가는 DB 제약으로 차단
- admin 판단은 `auth.users.app_metadata.role = 'admin'` (3절 참고)

## 6. 스키마를 바꿀 때
- 새 파일 `migrations/0002_xxx.sql` 을 추가하고 SQL Editor 에서 실행 (0001 은 다시 실행하지 않음)
- `src/types/database.ts` 도 같이 수정
- `pnpm db:check` 로 전체 마이그레이션 + 시드가 통과하는지 확인
