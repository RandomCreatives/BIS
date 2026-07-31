-- ============================================================================
-- Security hardening
--
-- 1. Never trust user-editable Auth metadata for authorization.
-- 2. Make deactivation effective at the database boundary.
-- 3. Preserve attendance/evaluation/report/lesson/IEP row integrity in RLS.
-- 4. Make announcements writable only through constrained RPCs.
-- 5. Bound security-definer RPC input and reduce their exposed privileges.
-- ============================================================================

begin;

-- Auth users may edit raw_user_meta_data. Only raw_app_meta_data (controlled by
-- an Auth admin/service-role client) may supply an initial role. Most invited
-- users intentionally start as subject_teacher and are assigned by an admin.
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

-- A deactivated profile has no effective role. This closes role-based policies
-- and all security-definer RPC checks immediately, even if its Auth session is
-- still valid.
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

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
  );
$$;

-- Users may edit only their own display name and phone. RLS determines which
-- rows may be updated; this trigger protects columns that RLS cannot compare
-- against OLD values. It also prevents an admin from disabling/demoting self.
create or replace function public.enforce_profile_self_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = (select auth.uid()) and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only full_name and phone may be changed on your own profile'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_self on public.profiles;
create trigger trg_profiles_protect_self
  before update on public.profiles
  for each row execute function public.enforce_profile_self_update();

-- Restrictive policies are ANDed with every existing permissive policy. This
-- makes account deactivation universal, including policies based directly on
-- auth.uid() relationships rather than my_role().
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'academic_years', 'terms', 'grade_levels', 'subjects',
    'classes', 'students', 'enrollments', 'teaching_assignments',
    'daily_attendance', 'term_criteria', 'student_evaluations',
    'term_reports', 'lesson_plans', 'iep_entries', 'announcements',
    'announcement_recipients'
  ]
  loop
    execute format('drop policy if exists active_staff_only on public.%I', table_name);
    execute format(
      'create policy active_staff_only on public.%I as restrictive for all to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()))',
      table_name
    );
  end loop;
end;
$$;

-- Relationship policies also verify the actor's current role. A stale class or
-- subject assignment must not preserve access after an administrator changes a
-- staff member's role.
drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments
for select to authenticated using (
  (select public.my_role()) in ('admin', 'principal')
  or exists (
    select 1
    from public.classes c
    where c.id = enrollments.class_id
      and (
        ((select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid()))
        or ((select public.my_role()) = 'assistant_teacher'
          and c.assistant_teacher_id = (select auth.uid()))
      )
  )
  or (
    (select public.my_role()) = 'subject_teacher'
    and exists (
      select 1
      from public.teaching_assignments ta
      where ta.class_id = enrollments.class_id
        and ta.teacher_id = (select auth.uid())
    )
  )
);

drop policy if exists students_read on public.students;
create policy students_read on public.students
for select to authenticated using (
  (select public.my_role()) in ('admin', 'principal')
  or (
    (select public.my_role()) = 'special_needs_teacher'
    and assigned_special_teacher_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = students.id
      and (
        ((select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid()))
        or ((select public.my_role()) = 'assistant_teacher'
          and c.assistant_teacher_id = (select auth.uid()))
        or (
          (select public.my_role()) = 'subject_teacher'
          and exists (
            select 1
            from public.teaching_assignments ta
            where ta.class_id = c.id
              and ta.teacher_id = (select auth.uid())
          )
        )
      )
  )
);

-- --------------------------------------------------------------------------
-- Attendance: the student must actually belong to the recorded class/year,
-- and marked_by must represent the authenticated last editor.
-- --------------------------------------------------------------------------
drop policy if exists attendance_read on public.daily_attendance;
drop policy if exists attendance_write on public.daily_attendance;
drop policy if exists attendance_update on public.daily_attendance;

create policy attendance_read on public.daily_attendance
for select to authenticated using (
  (select public.my_role()) in ('admin', 'principal')
  or exists (
    select 1
    from public.classes c
    where c.id = daily_attendance.class_id
      and (
        ((select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid()))
        or ((select public.my_role()) = 'assistant_teacher'
          and c.assistant_teacher_id = (select auth.uid()))
      )
  )
);

create policy attendance_write on public.daily_attendance
for insert to authenticated with check (
  marked_by = (select auth.uid())
  and (
    (select public.my_role()) = 'admin'
    or exists (
      select 1
      from public.classes c
      where c.id = daily_attendance.class_id
        and (
          ((select public.my_role()) = 'main_teacher'
            and c.main_teacher_id = (select auth.uid()))
          or ((select public.my_role()) = 'assistant_teacher'
            and c.assistant_teacher_id = (select auth.uid()))
        )
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

create policy attendance_update on public.daily_attendance
for update to authenticated using (
  (select public.my_role()) = 'admin'
  or exists (
    select 1
    from public.classes c
    where c.id = daily_attendance.class_id
      and (
        ((select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid()))
        or ((select public.my_role()) = 'assistant_teacher'
          and c.assistant_teacher_id = (select auth.uid()))
      )
  )
) with check (
  marked_by = (select auth.uid())
  and (
    (select public.my_role()) = 'admin'
    or exists (
      select 1
      from public.classes c
      where c.id = daily_attendance.class_id
        and (
          ((select public.my_role()) = 'main_teacher'
            and c.main_teacher_id = (select auth.uid()))
          or ((select public.my_role()) = 'assistant_teacher'
            and c.assistant_teacher_id = (select auth.uid()))
        )
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

-- --------------------------------------------------------------------------
-- Evaluations: tie reads and writes to the teacher's exact subject, class,
-- grade, academic year and term number. Re-check assignment on every update.
-- --------------------------------------------------------------------------
drop policy if exists evaluations_read on public.student_evaluations;
drop policy if exists evaluations_insert on public.student_evaluations;
drop policy if exists evaluations_update on public.student_evaluations;

create policy evaluations_read on public.student_evaluations
for select to authenticated using (
  (select public.my_role()) in ('admin', 'principal')
  or evaluated_by = (select auth.uid())
  or exists (
    select 1
    from public.term_criteria tc
    join public.terms t
      on t.id = student_evaluations.term_id
     and t.term_number = tc.term_number
    join public.enrollments e
      on e.student_id = student_evaluations.student_id
     and e.academic_year_id = t.academic_year_id
    join public.classes c
      on c.id = e.class_id
     and c.grade_level_id = tc.grade_level_id
    join public.teaching_assignments ta
      on ta.class_id = c.id
     and ta.subject_id = tc.subject_id
     and ta.teacher_id = (select auth.uid())
    where tc.id = student_evaluations.criteria_id
      and (select public.my_role()) = 'subject_teacher'
  )
  or exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = student_evaluations.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = student_evaluations.student_id
      and (select public.my_role()) = 'main_teacher'
      and c.main_teacher_id = (select auth.uid())
  )
);

create policy evaluations_insert on public.student_evaluations
for insert to authenticated with check (
  evaluated_by = (select auth.uid())
  and exists (
    select 1
    from public.term_criteria tc
    join public.terms t
      on t.id = student_evaluations.term_id
     and t.term_number = tc.term_number
     and t.locked_at is null
    join public.enrollments e
      on e.student_id = student_evaluations.student_id
     and e.academic_year_id = t.academic_year_id
    join public.classes c
      on c.id = e.class_id
     and c.grade_level_id = tc.grade_level_id
    where tc.id = student_evaluations.criteria_id
      and (
        (select public.my_role()) = 'admin'
        or (
          (select public.my_role()) = 'subject_teacher'
          and exists (
            select 1
            from public.teaching_assignments ta
            where ta.class_id = c.id
              and ta.subject_id = tc.subject_id
              and ta.teacher_id = (select auth.uid())
          )
        )
      )
  )
);

create policy evaluations_update on public.student_evaluations
for update to authenticated using (
  evaluated_by = (select auth.uid())
  or (select public.my_role()) = 'admin'
) with check (
  exists (
    select 1
    from public.term_criteria tc
    join public.terms t
      on t.id = student_evaluations.term_id
     and t.term_number = tc.term_number
     and t.locked_at is null
    join public.enrollments e
      on e.student_id = student_evaluations.student_id
     and e.academic_year_id = t.academic_year_id
    join public.classes c
      on c.id = e.class_id
     and c.grade_level_id = tc.grade_level_id
    where tc.id = student_evaluations.criteria_id
      and (
        (select public.my_role()) = 'admin'
        or (
          (select public.my_role()) = 'subject_teacher'
          and evaluated_by = (select auth.uid())
          and exists (
            select 1
            from public.teaching_assignments ta
            where ta.class_id = c.id
              and ta.subject_id = tc.subject_id
              and ta.teacher_id = (select auth.uid())
          )
        )
      )
  )
);

-- --------------------------------------------------------------------------
-- Reports: FOR ALL previously checked the main-teacher relationship only in
-- USING, which does not run for INSERT. Split commands and validate NEW rows.
-- --------------------------------------------------------------------------
drop policy if exists reports_read on public.term_reports;
drop policy if exists reports_teacher_draft on public.term_reports;
drop policy if exists reports_teacher_insert on public.term_reports;
drop policy if exists reports_teacher_update on public.term_reports;
drop policy if exists reports_teacher_delete on public.term_reports;

create policy reports_read on public.term_reports
for select to authenticated using (
  (select public.my_role()) in ('admin', 'principal')
  or exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = term_reports.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = term_reports.student_id
      and (
        ((select public.my_role()) = 'main_teacher'
          and c.main_teacher_id = (select auth.uid()))
        or ((select public.my_role()) = 'assistant_teacher'
          and c.assistant_teacher_id = (select auth.uid()))
      )
  )
);

create policy reports_teacher_insert on public.term_reports
for insert to authenticated with check (
  status = 'draft'
  and (select public.my_role()) = 'main_teacher'
  and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = term_reports.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = term_reports.student_id
      and c.main_teacher_id = (select auth.uid())
  )
);

create policy reports_teacher_update on public.term_reports
for update to authenticated using (
  status = 'draft'
  and (select public.my_role()) = 'main_teacher'
  and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = term_reports.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = term_reports.student_id
      and c.main_teacher_id = (select auth.uid())
  )
) with check (
  status = 'draft'
  and (select public.my_role()) = 'main_teacher'
  and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = term_reports.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = term_reports.student_id
      and c.main_teacher_id = (select auth.uid())
  )
);

create policy reports_teacher_delete on public.term_reports
for delete to authenticated using (
  status = 'draft'
  and (select public.my_role()) = 'main_teacher'
  and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.terms t
      on t.id = term_reports.term_id
     and t.academic_year_id = e.academic_year_id
    where e.student_id = term_reports.student_id
      and c.main_teacher_id = (select auth.uid())
  )
);

create or replace function public.enforce_teacher_report_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.my_role()) = 'main_teacher' then
    if new.status <> 'draft'
      or new.principal_signed_by is not null
      or new.principal_signed_at is not null
      or new.pdf_url is not null
      or new.generated_at is not null
      or new.published_at is not null
      or (new.main_teacher_signed_by is not null
          and new.main_teacher_signed_by <> (select auth.uid()))
    then
      raise exception 'Main teachers may edit draft report fields only'
        using errcode = '42501';
    end if;

    if (new.main_teacher_signed_by is null) <> (new.main_teacher_signed_at is null) then
      raise exception 'Main-teacher signature and timestamp must be set together';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_protect_fields on public.term_reports;
create trigger trg_reports_protect_fields
  before insert or update on public.term_reports
  for each row execute function public.enforce_teacher_report_fields();

-- --------------------------------------------------------------------------
-- Lesson plans: subject teachers may write only their current assignment and
-- cannot forge review fields. A submitted plan must have content or a file.
-- --------------------------------------------------------------------------
drop policy if exists lessons_teacher_write on public.lesson_plans;

create policy lessons_teacher_write on public.lesson_plans
for all to authenticated using (
  teacher_id = (select auth.uid())
  and (select public.my_role()) = 'subject_teacher'
  and status in ('draft', 'needs_revision')
  and exists (
    select 1
    from public.teaching_assignments ta
    join public.classes c on c.id = ta.class_id
    join public.terms t
      on t.id = lesson_plans.term_id
     and t.academic_year_id = c.academic_year_id
    where ta.teacher_id = (select auth.uid())
      and ta.subject_id = lesson_plans.subject_id
      and ta.class_id = lesson_plans.class_id
  )
) with check (
  teacher_id = (select auth.uid())
  and (select public.my_role()) = 'subject_teacher'
  and status in ('draft', 'submitted')
  and exists (
    select 1
    from public.teaching_assignments ta
    join public.classes c on c.id = ta.class_id
    join public.terms t
      on t.id = lesson_plans.term_id
     and t.academic_year_id = c.academic_year_id
    where ta.teacher_id = (select auth.uid())
      and ta.subject_id = lesson_plans.subject_id
      and ta.class_id = lesson_plans.class_id
  )
);

create or replace function public.enforce_lesson_plan_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.my_role()) = 'subject_teacher' then
    if tg_op = 'INSERT' then
      if new.admin_feedback is not null
        or new.reviewed_by is not null
        or new.reviewed_at is not null
        or new.submitted_at is not null
      then
        raise exception 'Teachers cannot set review fields'
          using errcode = '42501';
      end if;
    else
      if new.admin_feedback is distinct from old.admin_feedback
        or new.reviewed_by is distinct from old.reviewed_by
        or new.reviewed_at is distinct from old.reviewed_at
      then
        raise exception 'Teachers cannot change review fields'
          using errcode = '42501';
      end if;
      new.submitted_at := old.submitted_at;
    end if;

    if new.status = 'submitted' then
      if nullif(btrim(coalesce(new.plan_content, '')), '') is null
        and nullif(btrim(coalesce(new.file_url, '')), '') is null
      then
        raise exception 'A submitted lesson plan requires content or a file';
      end if;
      if tg_op = 'INSERT' or old.status is distinct from 'submitted' then
        new.submitted_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lessons_protect_fields on public.lesson_plans;
create trigger trg_lessons_protect_fields
  before insert or update on public.lesson_plans
  for each row execute function public.enforce_lesson_plan_fields();

-- IEP access requires the dedicated role. Authors may update only while they
-- remain assigned to that student; a role change therefore removes access.
drop policy if exists iep_read on public.iep_entries;
drop policy if exists iep_write on public.iep_entries;
drop policy if exists iep_update on public.iep_entries;

create policy iep_read on public.iep_entries
for select to authenticated using (
  (select public.my_role()) = 'admin'
  or (
    (select public.my_role()) = 'special_needs_teacher'
    and (
      author_id = (select auth.uid())
      or exists (
        select 1
        from public.students s
        where s.id = iep_entries.student_id
          and s.assigned_special_teacher_id = (select auth.uid())
      )
    )
  )
);

create policy iep_write on public.iep_entries
for insert to authenticated with check (
  author_id = (select auth.uid())
  and (
    (select public.my_role()) = 'admin'
    or (
      (select public.my_role()) = 'special_needs_teacher'
      and exists (
        select 1
        from public.students s
        where s.id = iep_entries.student_id
          and s.assigned_special_teacher_id = (select auth.uid())
      )
    )
  )
);

create policy iep_update on public.iep_entries
for update to authenticated using (
  (select public.my_role()) = 'admin'
  or (
    (select public.my_role()) = 'special_needs_teacher'
    and author_id = (select auth.uid())
    and exists (
      select 1
      from public.students s
      where s.id = iep_entries.student_id
        and s.assigned_special_teacher_id = (select auth.uid())
    )
  )
) with check (
  (select public.my_role()) = 'admin'
  or (
    (select public.my_role()) = 'special_needs_teacher'
    and author_id = (select auth.uid())
    and exists (
      select 1
      from public.students s
      where s.id = iep_entries.student_id
        and s.assigned_special_teacher_id = (select auth.uid())
    )
  )
);

-- --------------------------------------------------------------------------
-- Announcements: direct inserts/recipient updates make it possible to create
-- incomplete broadcasts or mutate recipient identity. RPCs are the only write
-- path and apply bounded, internally consistent inputs.
-- --------------------------------------------------------------------------
drop policy if exists announcements_write on public.announcements;
drop policy if exists recipients_mark_read on public.announcement_recipients;

create or replace function public.publish_announcement(
  p_title         text,
  p_content       text,
  p_audience      public.announcement_audience default 'all_staff',
  p_target_role   public.user_role default null,
  p_recipient_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expected_recipients integer;
  v_inserted_recipients integer;
begin
  if (select public.my_role()) not in ('admin', 'principal') then
    raise exception 'Only admin or principal can publish announcements'
      using errcode = '42501';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_content := btrim(coalesce(p_content, ''));
  if p_title = '' or length(p_title) > 200 then
    raise exception 'Announcement title must be 1 to 200 characters';
  end if;
  if p_content = '' or length(p_content) > 10000 then
    raise exception 'Announcement content must be 1 to 10000 characters';
  end if;

  if p_audience is null then
    raise exception 'Announcement audience is required';
  elsif p_audience = 'all_staff' then
    if p_target_role is not null or p_recipient_ids is not null then
      raise exception 'all_staff does not accept a target role or recipient list';
    end if;
  elsif p_audience = 'role' then
    if p_target_role is null or p_recipient_ids is not null then
      raise exception 'role audience requires only a target role';
    end if;
  elsif p_audience = 'individual' then
    if p_target_role is not null
      or coalesce(cardinality(p_recipient_ids), 0) = 0
      or cardinality(p_recipient_ids) > 100
      or array_position(p_recipient_ids, null) is not null
    then
      raise exception 'individual audience requires 1 to 100 recipient IDs';
    end if;
  end if;

  insert into public.announcements (sender_id, audience, target_role, title, content)
  values (
    (select auth.uid()),
    p_audience,
    case when p_audience = 'role' then p_target_role else null end,
    p_title,
    p_content
  )
  returning id into v_id;

  if p_audience = 'all_staff' then
    insert into public.announcement_recipients (announcement_id, recipient_id)
    select v_id, p.id from public.profiles p where p.is_active;
  elsif p_audience = 'role' then
    insert into public.announcement_recipients (announcement_id, recipient_id)
    select v_id, p.id
    from public.profiles p
    where p.is_active and p.role = p_target_role;
  else
    select count(distinct recipient_id)
      into v_expected_recipients
    from unnest(p_recipient_ids) as requested(recipient_id);

    insert into public.announcement_recipients (announcement_id, recipient_id)
    select v_id, p.id
    from public.profiles p
    where p.is_active and p.id = any(p_recipient_ids)
    on conflict do nothing;

    get diagnostics v_inserted_recipients = row_count;
    if v_inserted_recipients <> v_expected_recipients then
      raise exception 'One or more recipients do not exist or are inactive';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_active_staff()) then
    raise exception 'An active staff account is required'
      using errcode = '42501';
  end if;

  update public.announcement_recipients
  set read_at = now()
  where announcement_id = p_announcement_id
    and recipient_id = (select auth.uid())
    and read_at is null;
end;
$$;

-- Bound the direct RPC as well as its server action. SECURITY DEFINER bypasses
-- RLS, so validation and the active-admin check belong inside this function.
create or replace function public.import_students(p_year_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  v_class_id uuid;
  v_student  uuid;
  v_gender   text;
  v_dob      date;
  v_dob_raw  text;
  v_name     text;
  v_class    text;
  v_imported int := 0;
  v_errors   jsonb := '[]'::jsonb;
begin
  if (select public.my_role()) <> 'admin' then
    raise exception 'Only admin can import students'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be an array containing 1 to 1000 rows';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'p_rows must be an array containing 1 to 1000 rows';
  end if;

  if not exists (select 1 from public.academic_years where id = p_year_id) then
    raise exception 'Academic year not found';
  end if;

  for r in
    select t.idx, t.row
    from jsonb_array_elements(p_rows) with ordinality as t(row, idx)
  loop
    if jsonb_typeof(r.row) <> 'object' then
      v_errors := v_errors || jsonb_build_object('row', r.idx, 'error', 'Row must be an object');
      continue;
    end if;

    v_name := btrim(coalesce(r.row ->> 'full_name', ''));
    v_class := btrim(coalesce(r.row ->> 'class', ''));
    if v_name = '' or length(v_name) > 255 then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'error', 'full_name is required and must be at most 255 characters');
      continue;
    end if;
    if v_class = '' or length(v_class) > 100 then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name,
        'error', 'class is required and must be at most 100 characters');
      continue;
    end if;

    select c.id into v_class_id
    from public.classes c
    where c.academic_year_id = p_year_id
      and lower(c.class_name) = lower(v_class)
    limit 1;
    if v_class_id is null then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Class not found: "' || v_class || '"');
      continue;
    end if;

    v_gender := nullif(lower(btrim(coalesce(r.row ->> 'gender', ''))), '');
    if v_gender is not null and v_gender not in ('male', 'female') then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Invalid gender (use male/female)');
      continue;
    end if;

    v_dob_raw := nullif(btrim(coalesce(r.row ->> 'date_of_birth', '')), '');
    if v_dob_raw is not null and v_dob_raw !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Invalid date_of_birth (use YYYY-MM-DD)');
      continue;
    end if;
    begin
      v_dob := v_dob_raw::date;
    exception when others then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Invalid date_of_birth (use YYYY-MM-DD)');
      continue;
    end;

    if exists (
      select 1
      from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.academic_year_id = p_year_id
        and e.class_id = v_class_id
        and lower(s.full_name) = lower(v_name)
    ) then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Duplicate - already enrolled in this class');
      continue;
    end if;

    insert into public.students (full_name, gender, date_of_birth)
    values (v_name, v_gender, v_dob)
    returning id into v_student;

    insert into public.enrollments (student_id, class_id, academic_year_id)
    values (v_student, v_class_id, p_year_id);

    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end;
$$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Expose only
-- the RPCs/helpers required by authenticated clients; trigger functions remain
-- unreachable as direct API calls.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_profile_self_update() from public, anon, authenticated;
revoke all on function public.enforce_teacher_report_fields() from public, anon, authenticated;
revoke all on function public.enforce_lesson_plan_fields() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;
revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

revoke all on function public.publish_announcement(text, text, public.announcement_audience, public.user_role, uuid[]) from public, anon;
grant execute on function public.publish_announcement(text, text, public.announcement_audience, public.user_role, uuid[]) to authenticated;
revoke all on function public.mark_announcement_read(uuid) from public, anon;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
revoke all on function public.import_students(uuid, jsonb) from public, anon;
grant execute on function public.import_students(uuid, jsonb) to authenticated;

commit;
