-- =====================================================================
-- 0006: 쿼터 타이머를 DB 에 저장 → 여러 휴대폰에서 같은 타이머가 보이게
--   timer_running      : 흐르는 중인가
--   timer_end_at       : 흐르는 중이면 종료 예정 시각 (절대 시각이라 기기 간 동기화 가능)
--   timer_remaining_ms : 멈춰 있으면 남은 시간 (null 이면 duration_min 전체)
-- =====================================================================
alter table public.games add column if not exists timer_running boolean not null default false;
alter table public.games add column if not exists timer_end_at timestamptz;
alter table public.games add column if not exists timer_remaining_ms integer check (timer_remaining_ms is null or timer_remaining_ms >= 0);
comment on column public.games.timer_end_at is '타이머 종료 예정 시각. timer_running 일 때만 의미';
