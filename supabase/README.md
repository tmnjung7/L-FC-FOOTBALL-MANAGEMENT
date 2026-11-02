# Supabase 적용 안내 (2단계)

이 폴더에는 데이터베이스 구조(스키마)와 더미 데이터가 들어 있습니다.

| 파일 | 내용 |
|---|---|
| `migrations/0001_init.sql` | 테이블 12개, ENUM 8개, 집계 함수·뷰 2개, RLS(행 단위 권한) 정책, 인덱스 |
| `migrations/0002_open_access.sql` | 오픈형 접근(로그인 없이 조회·참석응답·평점) + 역할 3단계(admin / scorer / 팀원) + `set_user_role` |
| `migrations/0003_auto_roles.sql` | lfc1·lfc2·lfc3 계정을 만들기만 하면 역할 자동 부여 (트리거) |
| `seed.sql` | 가상 이름 선수 15명, 일요일 모임 8회 × 9쿼터, 득점·평점·출석·피드백·전술 더미 데이터 |

마이그레이션은 **번호 순서대로 한 번씩만** 실행합니다. (0001 을 이미 실행했다면 0002 만 추가 실행)

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

## 3. 대표 계정 3개 만들기 (lfc1 · lfc2 · lfc3)

앱은 **로그인 없이** 누구나 조회·참석 응답·평점 입력이 되고, **기록 입력만** 대표 계정으로 로그인해서 합니다.

| 아이디 | 역할 | 할 수 있는 것 |
|---|---|---|
| lfc1, lfc2 | admin (관리자) | 선수 등록·수정, 모임·쿼터·득점·출석, 전술, 보고서, 팀 설정 — 전부 |
| lfc3 | scorer (기록원) | 경기 중 입력: 모임 생성, 쿼터·편성, 득점, 출석 확정 |

Supabase 계정은 이메일 형식이 필요하므로 아이디 뒤에 `@lfc.team` 을 붙여 만듭니다. 앱 로그인 화면에서는 `lfc1` 만 치면 자동으로 붙습니다.

1. Supabase 대시보드 → 왼쪽 메뉴 **Authentication** → **Users** → 오른쪽 위 **Add user** → **Create new user**
2. Email: `lfc1@lfc.team`, Password: 원하는 비밀번호, **Auto Confirm User 체크** → Create user
3. 같은 방법으로 `lfc2@lfc.team`, `lfc3@lfc.team` 생성
4. `migrations/0003_auto_roles.sql` 을 SQL Editor 에서 한 번 실행하면 위 세 계정에 역할이 자동으로 붙습니다.
   (계정을 나중에 만들어도 자동 적용. 다른 이메일에 역할을 주고 싶으면 `select public.set_user_role('이메일', 'admin');`)
5. 앱에서 아이디 `lfc1` + 비밀번호로 로그인 → 홈 상단 이름 옆에 "관리자" 표시가 뜨면 성공
   "권한 없음" 으로 뜨면: 0003 실행 여부 확인 → 앱에서 **로그아웃 → 다시 로그인** (권한은 로그인할 때 토큰에 담깁니다)

비밀번호를 바꾸려면 Authentication → Users → 해당 계정 → ⋯ → Reset password 또는 Send password recovery 를 쓰면 됩니다.

## 4. 팀원은 어떻게 쓰나

- 링크를 열면 바로 보입니다. 로그인 없음.
- 홈에서 **"내 이름 선택"** 을 한 번 누르면 참석 응답·평점이 그 이름으로 기록됩니다 (휴대폰에 1년간 기억).
- 다른 사람 휴대폰을 빌려 쓸 땐 홈 상단 이름을 눌러 바꿀 수 있습니다.

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

### 권한(RLS) — 0002 기준
- 조회: 로그인 없이(anon) 전부 읽기 가능
- 참석 응답(예정 모임의 참석/불참만)·평점·피드백: 로그인 없이, 앱에서 고른 이름으로 쓰기. 자기 자신 평가는 DB 제약으로 차단
- 모임·쿼터·편성·득점·출석 확정: scorer 이상 (lfc3, lfc1, lfc2)
- 선수·전술·보고서·결산·팀 설정: admin 만 (lfc1, lfc2)
- 역할은 `auth.users.app_metadata.role` ('admin' / 'scorer'), `set_user_role()` 로 부여 (3절)

## 6. 스키마를 바꿀 때
- 새 파일 `migrations/0002_xxx.sql` 을 추가하고 SQL Editor 에서 실행 (0001 은 다시 실행하지 않음)
- `src/types/database.ts` 도 같이 수정
- `pnpm db:check` 로 전체 마이그레이션 + 시드가 통과하는지 확인
