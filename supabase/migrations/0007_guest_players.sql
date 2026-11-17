-- =====================================================================
-- 0007: 용병(게스트) 선수
--   players.is_guest = true 이면 용병. 출석·편성·득점은 일반 선수와 같지만
--   선수 목록에서는 별도 칸, 통계 랭킹·표에서는 제외(보고서에는 "(용병)"으로 포함)
-- =====================================================================
alter table public.players add column if not exists is_guest boolean not null default false;
create index if not exists idx_players_guest on public.players (is_guest);
notify pgrst, 'reload schema';
