-- =====================================================================
-- 0003: 대표 계정 자동 역할 부여
-- Authentication → Users 에서 아래 이메일로 계정을 만들기만 하면 역할이 자동으로 붙는다.
--   lfc1@lfc.team, lfc2@lfc.team → admin (관리자)
--   lfc3@lfc.team               → scorer (기록원)
-- 이미 만들어 둔 계정에도 즉시 적용된다. 여러 번 실행해도 안전하다.
-- =====================================================================

-- 이메일 → 역할 규칙 (바꾸고 싶으면 여기만 수정)
create or replace function public.default_role_for_email(p_email text)
returns text
language sql
immutable
as $$
  select case lower(p_email)
    when 'lfc1@lfc.team' then 'admin'
    when 'lfc2@lfc.team' then 'admin'
    when 'lfc3@lfc.team' then 'scorer'
    else null
  end;
$$;

-- 새 계정이 생길 때 자동으로 app_metadata.role 설정
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.default_role_for_email(new.email);
begin
  if v_role is not null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_default_role on auth.users;
create trigger trg_auth_user_default_role
  before insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 이미 만들어 둔 계정에 한 번 적용
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', public.default_role_for_email(u.email))
where public.default_role_for_email(u.email) is not null;

-- 확인: 대표 계정과 역할이 보이면 성공
select email, raw_app_meta_data ->> 'role' as role, created_at
from auth.users
where public.default_role_for_email(email) is not null
order by email;
