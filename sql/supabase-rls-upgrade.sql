-- Run once in the existing Supabase project.
-- This matches the current schema: departments, attendance_groups, admin_profiles.

create extension if not exists pgcrypto;

insert into public.departments (name, slug)
values
  ('L1 & L2','l1-l2'),
  ('L3','l3'),
  ('Games','games'),
  ('Higher Education','he')
on conflict (slug) do nothing;

create or replace function public.get_admin_department_id()
returns bigint
language sql
stable
security definer
set search_path=public
as $$
  select department_id from public.admin_profiles where user_id=auth.uid() limit 1;
$$;

revoke all on function public.get_admin_department_id() from public;
grant execute on function public.get_admin_department_id() to authenticated;

alter table public.departments enable row level security;
alter table public.attendance_groups enable row level security;
alter table public.admin_profiles enable row level security;

drop policy if exists "Public can read departments" on public.departments;
create policy "Public can read departments" on public.departments for select using (true);

drop policy if exists "Public can read leaderboard" on public.attendance_groups;
create policy "Public can read leaderboard" on public.attendance_groups for select using (true);
drop policy if exists "Admins can insert" on public.attendance_groups;
drop policy if exists "Admins can update" on public.attendance_groups;
drop policy if exists "Admins can delete" on public.attendance_groups;

drop policy if exists "Admins can insert own department" on public.attendance_groups;
create policy "Admins can insert own department" on public.attendance_groups for insert to authenticated with check (department_id=public.get_admin_department_id());

drop policy if exists "Admins can update own department" on public.attendance_groups;
create policy "Admins can update own department" on public.attendance_groups for update to authenticated using (department_id=public.get_admin_department_id()) with check (department_id=public.get_admin_department_id());

drop policy if exists "Admins can delete own department" on public.attendance_groups;
create policy "Admins can delete own department" on public.attendance_groups for delete to authenticated using (department_id=public.get_admin_department_id());

drop policy if exists "Admins can read own profile" on public.admin_profiles;
create policy "Admins can read own profile" on public.admin_profiles for select to authenticated using (user_id=auth.uid());

alter table public.attendance_groups replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='attendance_groups') then
    execute 'alter publication supabase_realtime add table public.attendance_groups';
  end if;
end $$;
