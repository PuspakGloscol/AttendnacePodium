-- Add recent attendance while keeping the existing attendance value as overall attendance.
alter table public.attendance_groups
  add column if not exists recent_attendance numeric(5,2);

-- Existing attendance values are preserved as the initial recent attendance.
update public.attendance_groups
set recent_attendance = attendance
where recent_attendance is null;

alter table public.attendance_groups
  alter column recent_attendance set default 0,
  alter column recent_attendance set not null;

alter table public.attendance_groups
  drop constraint if exists attendance_groups_recent_attendance_check;

alter table public.attendance_groups
  add constraint attendance_groups_recent_attendance_check
  check (recent_attendance >= 0 and recent_attendance <= 100);
