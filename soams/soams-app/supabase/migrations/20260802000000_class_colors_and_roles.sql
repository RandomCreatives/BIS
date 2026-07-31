-- ============================================================================
-- Class colors + staffing model alignment
--
-- School model (12 classes, one per grade level):
--   • Every class carries a color (Orange … Maroon).
--   • One Main Teacher per class (homeroom) owns attendance.
--   • Assistant Teachers support in-class only — they do NOT mark the register.
--   • Subject Teachers are assigned across multiple classes (teaching_assignments).
-- ============================================================================

begin;

-- 1. Class colors ---------------------------------------------------------
create type class_color as enum (
  'orange', 'crimson', 'magenta', 'yellow', 'red', 'purple',
  'blue', 'lavender', 'green', 'cyan', 'violet', 'maroon'
);

alter table classes
  add column color class_color not null default 'blue';

-- 2. Subjects -------------------------------------------------------------
-- Add Music to the seeded set (Amharic, English, French, Math, Science,
-- Fine Art, PE, ICT already exist). Idempotent.
insert into subjects (name) values ('Music')
on conflict (name) do nothing;

-- 3. Seed the 12 classes --------------------------------------------------
-- One class per grade level (Year 1 … Year 12), named "<Year N> <Color>",
-- for the current academic year. Runs only when that year has no classes yet.
insert into classes (class_name, grade_level_id, academic_year_id, color)
select g.name || ' ' || coalesce(c.label, 'Blue'), g.id, y.id, coalesce(c.color, 'blue')::class_color
from grade_levels g
join academic_years y on y.is_current
left join (values
  (1,  'orange',  'Orange'),
  (2,  'crimson', 'Crimson'),
  (3,  'magenta', 'Magenta'),
  (4,  'yellow',  'Yellow'),
  (5,  'red',     'Red'),
  (6,  'purple',  'Purple'),
  (7,  'blue',    'Blue'),
  (8,  'lavender','Lavender'),
  (9,  'green',   'Green'),
  (10, 'cyan',    'Cyan'),
  (11, 'violet',  'Violet'),
  (12, 'maroon',  'Maroon')
) as c(rn, color, label) on c.rn = g.sort_order
where not exists (
  select 1 from classes x where x.academic_year_id = y.id
);

-- 4. Attendance ownership --------------------------------------------------
-- Assistants support in-class only; only the class Main Teacher (plus
-- Admin/Principal) may mark or edit the register. Read stays open to the
-- assistant and the class teachers so the register is still visible in-room.
-- (Keeps the hardening guarantees: marked_by = self and the student must
-- actually be enrolled in the class/year on that date.)
drop policy if exists attendance_write on public.daily_attendance;
create policy attendance_write on public.daily_attendance for insert to authenticated with check (
  marked_by = (select auth.uid())
  and (
    (select public.my_role()) = 'admin'
    or exists (
      select 1
      from public.classes c
      where c.id = daily_attendance.class_id
        and (select public.my_role()) = 'main_teacher'
        and c.main_teacher_id = (select auth.uid())
    )
  )
  and exists (
    select 1
    from public.enrollments e
    join public.classes c
      on c.id = e.class_id
     and c.academic_year_id = e.academic_year_id
    join public.academic_years ay on ay.id = e.academic_year_id
    where e.student_id = daily_attendance.student_id
      and e.class_id = daily_attendance.class_id
      and daily_attendance.date between ay.start_date and ay.end_date
      and e.enrolled_on <= daily_attendance.date
      and (e.left_on is null or daily_attendance.date <= e.left_on)
  )
);

drop policy if exists attendance_update on public.daily_attendance;
create policy attendance_update on public.daily_attendance for update to authenticated
  using (
    (select public.my_role()) = 'admin'
    or exists (
      select 1
      from public.classes c
      where c.id = daily_attendance.class_id
        and (select public.my_role()) = 'main_teacher'
        and c.main_teacher_id = (select auth.uid())
    )
  )
  with check (
    marked_by = (select auth.uid())
    and (
      (select public.my_role()) = 'admin'
      or exists (
        select 1
        from public.classes c
        where c.id = daily_attendance.class_id
          and (select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid())
      )
    )
    and exists (
      select 1
      from public.enrollments e
      join public.classes c
        on c.id = e.class_id
       and c.academic_year_id = e.academic_year_id
      join public.academic_years ay on ay.id = e.academic_year_id
      where e.student_id = daily_attendance.student_id
        and e.class_id = daily_attendance.class_id
        and daily_attendance.date between ay.start_date and ay.end_date
        and e.enrolled_on <= daily_attendance.date
        and (e.left_on is null or daily_attendance.date <= e.left_on)
    )
  );

commit;
