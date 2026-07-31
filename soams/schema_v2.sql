-- ============================================================================
-- REFERENCE SNAPSHOT ONLY — DO NOT DEPLOY THIS FILE BY ITSELF.
-- The canonical, security-hardened history is soams-app/supabase/migrations/;
-- apply every migration there in filename order.
-- ============================================================================

-- ============================================================================
-- SOAMS — School Operations & Academic Management System
-- Database Schema v2 (Supabase / PostgreSQL 14+)
--
-- Supersedes: Database.md v1
-- Changelog & rationale: see SCHEMA_V2_NOTES.md
--
-- HOW TO APPLY: run this entire file once in the Supabase SQL Editor on a
-- fresh project. It is idempotent-unsafe by design (plain CREATE statements);
-- do not re-run against an existing database.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto;  -- gen_random_uuid() (preinstalled on Supabase)


-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================
create type user_role as enum (
  'admin',
  'principal',            -- NEW v2: explicit role for certificate sign-off
  'main_teacher',
  'assistant_teacher',
  'subject_teacher',
  'special_needs_teacher'
);

create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type attainment_level  as enum ('WT', 'WW', 'WA');   -- Working Towards / Within / Above
create type habit_grade       as enum ('E', 'G', 'S', 'N'); -- Excellent / Good / Satisfactory / Needs improvement
create type plan_status       as enum ('draft', 'submitted', 'approved', 'needs_revision');
create type report_status     as enum ('draft', 'published');
create type iep_entry_type    as enum ('target', 'progress', 'behavior', 'milestone');
create type announcement_audience as enum ('all_staff', 'role', 'individual');
create type student_status    as enum ('active', 'transferred', 'graduated');


-- ============================================================================
-- 2. ACADEMIC CALENDAR  (NEW v2 — fixes gap #2: no academic year dimension)
-- ============================================================================
create table academic_years (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,              -- e.g. '2026/2027'
  start_date date not null,
  end_date   date not null,
  is_current boolean not null default false,
  check (end_date > start_date)
);

-- Only one year may be "current" at a time.
create unique index one_current_year on academic_years (is_current) where is_current;

create table terms (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete restrict,
  term_number      int  not null check (term_number in (1, 2, 3)),
  start_date       date not null,
  end_date         date not null,
  locked_at        timestamptz,  -- NEW v2 (gap #9): admin closes data entry for the term
  unique (academic_year_id, term_number),
  check (end_date > start_date)
);
-- NOTE: term date ranges drive attendance totals on certificates
-- (no term_id needed on daily_attendance — computed from date).


-- ============================================================================
-- 3. USERS / PROFILES  (linked to Supabase Auth — fixes gap: no auth linkage)
-- ============================================================================
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  phone      text,
  role       user_role not null,          -- no insecure default; admin assigns explicitly
  is_active  boolean not null default true,  -- deactivate leavers instead of deleting history
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a user is invited through Supabase Auth.
-- full_name is display data; only trusted app metadata may seed a role. Never
-- authorize from raw_user_meta_data because an Auth user can edit it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      255
    ),
    new.email,
    case
      when (new.raw_app_meta_data ->> 'role') in (
        'admin', 'principal', 'main_teacher', 'assistant_teacher',
        'subject_teacher', 'special_needs_teacher'
      ) then (new.raw_app_meta_data ->> 'role')::public.user_role
      else 'subject_teacher'::public.user_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: role of the currently authenticated user (used throughout RLS policies).
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;


-- ============================================================================
-- 4. ACADEMIC STRUCTURE
-- ============================================================================
create table grade_levels (       -- NEW v2 (gap #7): criteria keyed by GRADE, not yearly class
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,   -- e.g. 'Year 3'  (adjust to the school's naming)
  sort_order int  not null unique
);

create table subjects (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,    -- Amharic, English, French, Fine Art, PE, ICT, ...
  is_active boolean not null default true
);

-- Classes are scoped to an academic year and recreated each September.
-- Rollover is cheap (see SCHEMA_V2_NOTES.md) and keeps every year's data intact.
create table classes (
  id                  uuid primary key default gen_random_uuid(),
  class_name          text not null,                        -- e.g. 'Year 3 Magenta'
  grade_level_id      uuid not null references grade_levels(id) on delete restrict,
  academic_year_id    uuid not null references academic_years(id) on delete restrict,
  main_teacher_id     uuid references profiles(id) on delete set null,
  assistant_teacher_id uuid references profiles(id) on delete set null,
  unique (class_name, academic_year_id),  -- names may repeat across years
  unique (id, academic_year_id)           -- FK target for enrollments composite key
);


-- ============================================================================
-- 5. STUDENTS & ENROLLMENTS  (fixes gap #3: enrollment history + gap #6 cascade)
-- ============================================================================
create table students (
  id                          uuid primary key default gen_random_uuid(),
  full_name                   text not null,
  gender                      text check (gender in ('male', 'female')),
  date_of_birth               date,
  is_special_needs            boolean not null default false,
  assigned_special_teacher_id uuid references profiles(id) on delete set null,
  status                      student_status not null default 'active',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
  -- NOTE: NO class_id here (v1 bug). A student's class lives in enrollments,
  -- which preserves which class they were in for every academic year.
);

create table enrollments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  class_id         uuid not null references classes(id) on delete restrict,  -- v1 deleted students with a class!
  academic_year_id uuid not null references academic_years(id) on delete restrict,
  enrolled_on      date not null default current_date,
  left_on          date,                        -- mid-year transfers
  unique (student_id, academic_year_id),        -- one class per student per year
  -- Guarantees the class actually belongs to the stated academic year:
  foreign key (class_id, academic_year_id)
    references classes (id, academic_year_id)
);


-- ============================================================================
-- 6. TEACHING ASSIGNMENTS  (NEW v2 — fixes gap #4)
--    Powers: admin subject-allocation UI, evaluation RLS, lesson plan RLS.
-- ============================================================================
create table teaching_assignments (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  class_id   uuid not null references classes(id)  on delete cascade,
  unique (teacher_id, subject_id, class_id)  -- class is year-scoped, so renews yearly
);


-- ============================================================================
-- 7. DAILY ATTENDANCE
-- ============================================================================
create table daily_attendance (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id   uuid not null references classes(id)  on delete restrict, -- snapshot for fast class-roster grids
  date       date not null default current_date,
  status     attendance_status not null,
  marked_by  uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);
-- Term attendance totals = rows where date falls within the term's date range
-- (see v_term_certificate_data view in section 9).


-- ============================================================================
-- 8. STANDARDS-BASED EVALUATION
-- ============================================================================
-- Criteria describe the REUSABLE curriculum (per subject / grade / term number),
-- so they are defined once and survive year rollover. Retire — don't delete —
-- outdated criteria with is_active = false to protect historical evaluations.
create table term_criteria (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references subjects(id) on delete restrict,
  grade_level_id uuid not null references grade_levels(id) on delete restrict,
  term_number    int  not null check (term_number in (1, 2, 3)),
  description    text not null,
  sort_order     int  not null default 0,   -- controls certificate layout order
  is_active      boolean not null default true,
  unique (subject_id, grade_level_id, term_number, description)
);

create table student_evaluations (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  criteria_id uuid not null references term_criteria(id) on delete restrict,
  term_id     uuid not null references terms(id) on delete restrict,  -- ties entry to year + term
  attainment  attainment_level not null,
  evaluated_by uuid not null references profiles(id) on delete restrict,
  updated_at  timestamptz not null default now(),
  unique (student_id, criteria_id, term_id)
);


-- ============================================================================
-- 9. TERM REPORTS / CERTIFICATES  (fixes gap #8 sign-off + gap #9 publishing)
-- ============================================================================
create table term_reports (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references students(id) on delete cascade,
  term_id               uuid not null references terms(id) on delete restrict,
  work_habit_grade      habit_grade not null default 'S',
  teacher_remarks       text,
  status                report_status not null default 'draft',
  main_teacher_signed_by uuid references profiles(id),
  main_teacher_signed_at timestamptz,
  principal_signed_by    uuid references profiles(id),
  principal_signed_at    timestamptz,
  pdf_url               text,          -- generated certificate in Supabase Storage
  generated_at          timestamptz,
  published_at          timestamptz,   -- set when certificates are issued; freezes edits
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (student_id, term_id)
);

-- One-query data source for the PDF certificate engine:
-- report + student + class + attendance totals, all per term.
create or replace view v_term_certificate_data
with (security_invoker = true) as   -- view respects the querying user's RLS
select
  tr.id                as report_id,
  s.id                 as student_id,
  s.full_name          as student_name,
  c.class_name,
  gl.name              as grade_level,
  ay.name              as academic_year,
  t.term_number,
  tr.work_habit_grade,
  tr.teacher_remarks,
  tr.status            as report_status,
  tr.pdf_url,
  count(a.id) filter (where a.status = 'present') as days_present,
  count(a.id) filter (where a.status = 'late')    as days_late,
  count(a.id) filter (where a.status = 'absent')  as days_absent,
  count(a.id) filter (where a.status = 'excused') as days_excused
from term_reports tr
join students       s  on s.id  = tr.student_id
join terms          t  on t.id  = tr.term_id
join academic_years ay on ay.id = t.academic_year_id
join enrollments    e  on e.student_id = tr.student_id
                      and e.academic_year_id = ay.id
join classes        c  on c.id  = e.class_id
join grade_levels   gl on gl.id = c.grade_level_id
left join daily_attendance a
       on a.student_id = s.id
      and a.date between t.start_date and t.end_date
group by tr.id, s.id, s.full_name, c.class_name, gl.name, ay.name, t.term_number,
         tr.work_habit_grade, tr.teacher_remarks, tr.status, tr.pdf_url;
-- Per-subject WT/WW/WA rows are fetched separately from student_evaluations
-- joined through term_criteria (grouped by subject) when rendering the PDF.


-- ============================================================================
-- 10. WEEKLY LESSON PLANS
-- ============================================================================
create table lesson_plans (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete restrict,
  subject_id  uuid not null references subjects(id) on delete restrict,
  class_id    uuid not null references classes(id)  on delete cascade,
  term_id     uuid not null references terms(id)    on delete restrict,
  week_number int  not null check (week_number between 1 and 12),
  plan_content text,             -- inline text and/or uploaded file (at least one required to SUBMIT — enforced in app)
  file_url    text,              -- Supabase Storage path, bucket: lesson-plan-files
  status      plan_status not null default 'draft',
  admin_feedback text,
  submitted_at timestamptz,
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (teacher_id, subject_id, class_id, term_id, week_number)
);


-- ============================================================================
-- 11. SPECIAL NEEDS — IEP LOG  (NEW v2 — fixes gap #1: SRD Module 5 had no table)
-- ============================================================================
create table iep_entries (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete restrict,
  entry_type iep_entry_type not null default 'progress',
  title      text not null,
  body       text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- PRIVACY-CRITICAL: RLS below restricts access to the assigned SN teacher + admin.
);


-- ============================================================================
-- 12. COMMUNICATION HUB  (fixes gap #5: individual targeting + read receipts)
-- ============================================================================
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  sender_id  uuid not null references profiles(id) on delete restrict,
  audience   announcement_audience not null default 'all_staff',
  target_role user_role,                        -- only when audience = 'role'
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

-- Recipients are MATERIALIZED at publish time (~40 rows max at this scale).
-- read_at NULL  => unread   |   read_at set  => acknowledged (satisfies FR-6.2)
create table announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  recipient_id    uuid not null references profiles(id) on delete cascade,
  read_at         timestamptz,
  primary key (announcement_id, recipient_id)
);

-- Recommended publish path: one call creates the announcement AND its recipients.
--   select publish_announcement('Staff meeting Friday', 'Room 4 at 14:00');
--   select publish_announcement('Term 1 deadlines', '...', 'role', 'main_teacher');
--   select publish_announcement('Contract renewal', '...', 'individual', null, array['<uuid>']);
create or replace function public.publish_announcement(
  p_title         text,
  p_content       text,
  p_audience      announcement_audience default 'all_staff',
  p_target_role   user_role default null,
  p_recipient_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.my_role() not in ('admin', 'principal') then
    raise exception 'Only admin or principal can publish announcements';
  end if;

  insert into announcements (sender_id, audience, target_role, title, content)
  values (auth.uid(), p_audience, p_target_role, p_title, p_content)
  returning id into v_id;

  if p_audience = 'all_staff' then
    insert into announcement_recipients (announcement_id, recipient_id)
    select v_id, id from profiles where is_active;
  elsif p_audience = 'role' then
    insert into announcement_recipients (announcement_id, recipient_id)
    select v_id, id from profiles where is_active and role = p_target_role;
  else
    insert into announcement_recipients (announcement_id, recipient_id)
    select v_id, unnest(p_recipient_ids);
  end if;

  return v_id;
end;
$$;

-- One-tap acknowledge (drives the "unread" badge and read receipts).
create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update announcement_recipients
  set read_at = now()
  where announcement_id = p_announcement_id
    and recipient_id = auth.uid()
    and read_at is null;
end;
$$;


-- ============================================================================
-- 13. INDEXES (performance for the hot paths)
-- ============================================================================
create index idx_attendance_class_date on daily_attendance (class_id, date);
create index idx_enrollments_class     on enrollments (class_id);
create index idx_enrollments_student   on enrollments (student_id);
create index idx_ta_teacher            on teaching_assignments (teacher_id);
create index idx_ta_class              on teaching_assignments (class_id);
create index idx_eval_student_term     on student_evaluations (student_id, term_id);
create index idx_eval_criteria         on student_evaluations (criteria_id);
create index idx_criteria_lookup       on term_criteria (subject_id, grade_level_id, term_number);
create index idx_lesson_class_term     on lesson_plans (class_id, term_id);
create index idx_lesson_teacher        on lesson_plans (teacher_id);
create index idx_iep_student           on iep_entries (student_id, entry_date desc);
create index idx_recipients_unread     on announcement_recipients (recipient_id) where read_at is null;
create index idx_classes_year          on classes (academic_year_id);
create index idx_term_reports_term     on term_reports (term_id);


-- ============================================================================
-- 14. updated_at TRIGGERS
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated    before update on profiles            for each row execute function public.set_updated_at();
create trigger trg_students_updated    before update on students            for each row execute function public.set_updated_at();
create trigger trg_evaluations_updated before update on student_evaluations for each row execute function public.set_updated_at();
create trigger trg_reports_updated     before update on term_reports        for each row execute function public.set_updated_at();
create trigger trg_lessons_updated     before update on lesson_plans        for each row execute function public.set_updated_at();
create trigger trg_iep_updated         before update on iep_entries         for each row execute function public.set_updated_at();


-- ============================================================================
-- 15. ROW-LEVEL SECURITY  (starter policies — see SCHEMA_V2_NOTES.md section 4)
-- ============================================================================
alter table profiles                enable row level security;
alter table academic_years          enable row level security;
alter table terms                   enable row level security;
alter table grade_levels            enable row level security;
alter table subjects                enable row level security;
alter table classes                 enable row level security;
alter table students                enable row level security;
alter table enrollments             enable row level security;
alter table teaching_assignments    enable row level security;
alter table daily_attendance        enable row level security;
alter table term_criteria           enable row level security;
alter table student_evaluations     enable row level security;
alter table term_reports            enable row level security;
alter table lesson_plans            enable row level security;
alter table iep_entries             enable row level security;
alter table announcements           enable row level security;
alter table announcement_recipients enable row level security;

-- ---- Reference data: readable by all staff, writable by admin/principal ----
create policy refdata_read  on academic_years for select to authenticated using (true);
create policy refdata_write on academic_years for all    to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));
create policy refdata_read  on terms          for select to authenticated using (true);
create policy refdata_write on terms          for all    to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));
create policy refdata_read  on grade_levels   for select to authenticated using (true);
create policy refdata_write on grade_levels   for all    to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));
create policy refdata_read  on subjects       for select to authenticated using (true);
create policy refdata_write on subjects       for all    to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));
create policy criteria_read  on term_criteria for select to authenticated using (true);
create policy criteria_write on term_criteria for all    to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));

-- ---- Profiles: own row, admin sees/manages all; role cannot be self-changed ----
create policy profiles_read_own   on profiles for select to authenticated using (id = auth.uid());
create policy profiles_read_admin on profiles for select to authenticated using (public.my_role() in ('admin','principal'));
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role()); -- no self role-escalation
create policy profiles_admin_all on profiles for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- Classes & enrollments & teaching assignments ----
create policy classes_read  on classes for select to authenticated using (true);
create policy classes_write on classes for all to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));
create policy ta_read  on teaching_assignments for select to authenticated using (true);
create policy ta_write on teaching_assignments for all to authenticated using (public.my_role() in ('admin','principal')) with check (public.my_role() in ('admin','principal'));

create policy enrollments_read on enrollments for select to authenticated using (
  public.my_role() in ('admin','principal')
  or exists (select 1 from classes c
             where c.id = enrollments.class_id
               and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid()))
  or exists (select 1 from teaching_assignments ta
             where ta.class_id = enrollments.class_id and ta.teacher_id = auth.uid())
);
create policy enrollments_write on enrollments for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- Students: only staff with a working relationship to the student ----
create policy students_read on students for select to authenticated using (
  public.my_role() in ('admin','principal')
  or assigned_special_teacher_id = auth.uid()
  or exists (select 1
             from enrollments e
             join classes c on c.id = e.class_id
             left join teaching_assignments ta
                    on ta.class_id = c.id and ta.teacher_id = auth.uid()
             where e.student_id = students.id
               and (c.main_teacher_id = auth.uid()
                 or c.assistant_teacher_id = auth.uid()
                 or ta.teacher_id is not null))
);
create policy students_write on students for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- Attendance: main/assistant teacher of the class (admin overrides) ----
create policy attendance_read on daily_attendance for select to authenticated using (
  public.my_role() in ('admin','principal')
  or marked_by = auth.uid()
  or exists (select 1 from classes c
             where c.id = daily_attendance.class_id
               and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid()))
);
create policy attendance_write on daily_attendance for insert to authenticated with check (
  public.my_role() = 'admin'
  or exists (select 1 from classes c
             where c.id = class_id
               and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid()))
);
create policy attendance_update on daily_attendance for update to authenticated
  using (public.my_role() = 'admin'
         or exists (select 1 from classes c
                    where c.id = daily_attendance.class_id
                      and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid())))
  with check (public.my_role() = 'admin'
         or exists (select 1 from classes c
                    where c.id = daily_attendance.class_id
                      and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid())));

-- ---- Evaluations: subject teacher may write ONLY for their assignments, and
-- ---- ONLY while the term is unlocked. Main teacher may read their class. ----
create policy evaluations_read on student_evaluations for select to authenticated using (
  public.my_role() in ('admin','principal')
  or evaluated_by = auth.uid()
  or exists (select 1 from term_criteria tc
             join teaching_assignments ta on ta.subject_id = tc.subject_id
             where ta.teacher_id = auth.uid() and tc.id = student_evaluations.criteria_id)
  or exists (select 1 from enrollments e
             join classes c on c.id = e.class_id
             join terms t   on t.id = student_evaluations.term_id
             where e.student_id = student_evaluations.student_id
               and e.academic_year_id = t.academic_year_id
               and c.main_teacher_id = auth.uid())
);
create policy evaluations_insert on student_evaluations for insert to authenticated with check (
  not exists (select 1 from terms t where t.id = term_id and t.locked_at is not null)
  and (
    public.my_role() = 'admin'
    or exists (select 1
               from term_criteria tc
               join teaching_assignments ta
                 on ta.subject_id = tc.subject_id and ta.teacher_id = auth.uid()
               join enrollments e
                 on e.class_id = ta.class_id and e.student_id = student_evaluations.student_id
               join terms t
                 on t.id = student_evaluations.term_id and t.academic_year_id = e.academic_year_id
               where tc.id = student_evaluations.criteria_id)
  )
);
create policy evaluations_update on student_evaluations for update to authenticated
  using (evaluated_by = auth.uid() or public.my_role() = 'admin')
  with check (
    not exists (select 1 from terms t where t.id = term_id and t.locked_at is not null)
    and (evaluated_by = auth.uid() or public.my_role() = 'admin')
  );

-- ---- Term reports: main teacher drafts; admin/principal publish ----
create policy reports_read on term_reports for select to authenticated using (
  public.my_role() in ('admin','principal')
  or exists (select 1 from enrollments e
             join classes c on c.id = e.class_id
             join terms t   on t.id = term_reports.term_id
             where e.student_id = term_reports.student_id
               and e.academic_year_id = t.academic_year_id
               and (c.main_teacher_id = auth.uid() or c.assistant_teacher_id = auth.uid()))
);
create policy reports_teacher_draft on term_reports for all to authenticated
  using (status = 'draft'
         and exists (select 1 from enrollments e
                     join classes c on c.id = e.class_id
                     join terms t   on t.id = term_reports.term_id
                     where e.student_id = term_reports.student_id
                       and e.academic_year_id = t.academic_year_id
                       and c.main_teacher_id = auth.uid()))
  with check (status = 'draft');  -- teachers can never flip status to 'published'
create policy reports_admin_all on term_reports for all to authenticated
  using (public.my_role() in ('admin','principal'))
  with check (public.my_role() in ('admin','principal'));

-- ---- Lesson plans: author manages drafts/submissions; admin reviews ----
create policy lessons_read on lesson_plans for select to authenticated using (
  teacher_id = auth.uid() or public.my_role() in ('admin','principal')
);
create policy lessons_teacher_write on lesson_plans for all to authenticated
  using (teacher_id = auth.uid() and status in ('draft','needs_revision'))
  with check (teacher_id = auth.uid() and status in ('draft','needs_revision','submitted'));
create policy lessons_admin_all on lesson_plans for all to authenticated
  using (public.my_role() in ('admin','principal'))
  with check (public.my_role() in ('admin','principal'));

-- ---- IEP entries: PRIVACY-CRITICAL — assigned SN teacher + admin only ----
create policy iep_read on iep_entries for select to authenticated using (
  author_id = auth.uid()
  or public.my_role() = 'admin'
  or exists (select 1 from students s
             where s.id = iep_entries.student_id
               and s.assigned_special_teacher_id = auth.uid())
);
create policy iep_write on iep_entries for insert to authenticated with check (
  author_id = auth.uid()
  and (public.my_role() = 'admin'
       or exists (select 1 from students s
                  where s.id = student_id
                    and s.assigned_special_teacher_id = auth.uid()))
);
create policy iep_update on iep_entries for update to authenticated
  using (author_id = auth.uid() or public.my_role() = 'admin')
  with check (author_id = auth.uid() or public.my_role() = 'admin');

-- ---- Announcements: publish via RPC; recipients read their own ----
create policy announcements_read on announcements for select to authenticated using (
  public.my_role() in ('admin','principal')
  or exists (select 1 from announcement_recipients r
             where r.announcement_id = announcements.id and r.recipient_id = auth.uid())
);
create policy announcements_write on announcements for insert to authenticated
  with check (public.my_role() in ('admin','principal') and sender_id = auth.uid());

create policy recipients_read on announcement_recipients for select to authenticated using (
  recipient_id = auth.uid() or public.my_role() in ('admin','principal')
);
create policy recipients_mark_read on announcement_recipients for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());


-- ============================================================================
-- 16. SEED DATA  (adjust names/dates to the school's actual calendar)
-- ============================================================================
insert into grade_levels (name, sort_order) values
  ('Year 1', 1), ('Year 2', 2), ('Year 3', 3), ('Year 4', 4),
  ('Year 5', 5), ('Year 6', 6), ('Year 7', 7), ('Year 8', 8),
  ('Year 9', 9), ('Year 10', 10), ('Year 11', 11), ('Year 12', 12);

insert into subjects (name) values
  ('Amharic'), ('English'), ('French'), ('Mathematics'),
  ('Science'), ('Fine Art'), ('PE'), ('ICT');

-- Sample academic year — REPLACE dates with the school's real 2026/2027 calendar.
insert into academic_years (name, start_date, end_date, is_current) values
  ('2026/2027', date '2026-09-01', date '2027-06-30', true);

insert into terms (academic_year_id, term_number, start_date, end_date)
select ay.id, t.term_number, t.start_date, t.end_date
from academic_years ay
cross join (values
  (1, date '2026-09-01', date '2026-12-11'),
  (2, date '2027-01-04', date '2027-03-26'),
  (3, date '2027-04-05', date '2027-06-25')
) as t(term_number, start_date, end_date)
where ay.name = '2026/2027';

-- ============================================================================
-- END OF SCHEMA V2
-- Next steps: create Storage buckets (lesson-plan-files, generated-certificates)
-- and run the year-rollover checklist — see SCHEMA_V2_NOTES.md.
-- ============================================================================
