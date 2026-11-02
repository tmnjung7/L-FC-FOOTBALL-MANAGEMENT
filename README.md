# 풋살 매니저 (futsal-manager)

친구들과 하는 풋살 모임의 **기록 관리 + 통계 + 전술판** PWA(홈 화면에 설치되는 웹앱)입니다.
매주 일요일 모임, 모임당 8~10쿼터, 쿼터마다 팀 편성이 바뀌는 구조에 맞춰 설계했습니다.

- 스택: Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Zustand · react-konva · Recharts · Serwist(PWA) · Vercel
- 프로젝트 규칙과 진행 상황: [CLAUDE.md](./CLAUDE.md)

## 현재 상태 (3단계 진행 중: 로그인 + 홈 완료)
- 하단 탭 5개(홈 / 경기 / 선수 / 통계 / 전술판). 홈 완성, 나머지는 "준비 중" 플레이스홀더
- 오픈형: 로그인 없이 조회·참석 응답·평점. 대표 계정(lfc1·lfc2 관리자, lfc3 기록원)만 기록 입력 — 계정 생성은 [supabase/README.md](./supabase/README.md) 3절
- 모바일 우선 레이아웃(360px~), 터치 타깃 44px, iOS safe-area 대응
- PWA manifest + 서비스워커(프로덕션 빌드에서만 활성)
- 데이터 모델 완료: `supabase/migrations/0001_init.sql`(테이블 12개·집계 뷰·RLS), `supabase/seed.sql`(가상 15명 더미), `src/types/database.ts`
- 적용 순서는 [supabase/README.md](./supabase/README.md) 참고. 올리기 전 `pnpm db:check` 로 로컬 검증 가능

## 1. 내 컴퓨터에서 실행하기

### 준비물
- Node.js 20 이상 (https://nodejs.org)
- pnpm: 터미널에서 `npm install -g pnpm`

### 실행
```bash
git clone <이 저장소 주소>
cd futsal-manager
pnpm install
cp .env.local.example .env.local   # Windows PowerShell: copy .env.local.example .env.local
pnpm dev
```
브라우저에서 http://localhost:3000 을 열면 됩니다. (아직 Supabase 값이 비어 있어도 1단계 화면은 뜹니다.)

### 휴대폰 브라우저에서 확인하기
1. 휴대폰과 컴퓨터를 **같은 와이파이**에 연결합니다.
2. 컴퓨터의 내부 IP를 확인합니다.
   - Mac: `ipconfig getifaddr en0`
   - Windows: `ipconfig` 실행 후 "IPv4 주소" (예: 192.168.0.12)
3. 개발 서버를 외부 접속 허용으로 실행합니다.
   ```bash
   pnpm dev -H 0.0.0.0
   ```
4. 휴대폰 브라우저에서 `http://<컴퓨터IP>:3000` 접속. (예: http://192.168.0.12:3000)
5. 안 열리면 컴퓨터 방화벽에서 3000 포트를 허용하거나, 잠시 방화벽을 끄고 시도합니다.

> 홈 화면 설치(PWA)와 오프라인 캐시는 `pnpm build && pnpm start` 로 띄운 프로덕션 모드에서만 동작합니다.

## 2. Supabase 프로젝트 만들기 (직접 해야 하는 일)

1. https://supabase.com 접속 → GitHub 또는 이메일로 가입/로그인
2. **New project** 클릭
   - Organization: 기본값
   - Project name: `futsal-manager`
   - Database Password: 강한 비밀번호 생성 후 **어딘가에 꼭 저장** (나중에 백업·복구에 필요)
   - Region: `Northeast Asia (Seoul)` 또는 `Tokyo` 선택
   - Pricing plan: Free
3. 프로젝트 생성이 끝나면(1~2분) 왼쪽 메뉴 **Project Settings(톱니바퀴) → API** 로 이동
4. 아래 두 값을 복사합니다.
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys → anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ `service_role` 키는 절대 앱 코드나 .env.local에 넣지 마세요. (관리자 전권 키)
5. 프로젝트 루트의 `.env.local` 파일을 열어 값을 채웁니다.
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```
6. `.env.local` 은 `.gitignore` 에 포함되어 있어 GitHub에 올라가지 않습니다. (확인: `git check-ignore .env.local` 이 파일명을 출력하면 정상)
7. 개발 서버를 재시작(`pnpm dev`)합니다.

테이블(스키마) 생성은 **2단계**에서 SQL 파일을 만들어 드리고, Supabase SQL Editor에 붙여넣는 방법을 안내합니다.

## 3. Vercel 배포 (직접 해야 하는 일)

1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New → Project** → 이 GitHub 저장소(`futsal-manager`) **Import**
3. Framework Preset 이 `Next.js` 로 자동 인식되는지 확인. Build Command 는 기본값(`next build`)
4. **Environment Variables** 에 아래 두 개 추가 (값은 Supabase에서 복사한 것)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy** → 1~2분 후 `https://futsal-manager-xxxx.vercel.app` 주소가 생깁니다. 이 링크를 팀 단톡방에 공유하면 됩니다.
6. 이후에는 GitHub `main` 브랜치에 푸시할 때마다 자동으로 재배포됩니다.

(5단계에서 Supabase Auth 의 Redirect URL 에 Vercel 주소를 등록하는 절차를 추가로 안내합니다.)

## 4. 자주 쓰는 명령
```bash
pnpm dev                 # 개발 서버
pnpm build               # 프로덕션 빌드
pnpm start               # 빌드 결과 실행 (PWA 확인용)
pnpm lint                # 코드 검사
pnpm exec tsc --noEmit   # 타입 검사
```

## 5. 다음 단계
- ~~2단계: 데이터 모델~~ (완료)
- 3단계: 화면 구현
- 4단계: 전술 현황판
- 4-2단계: 경기 보고서 + 카카오톡 공유
- 5단계: 검증·배포·백업
