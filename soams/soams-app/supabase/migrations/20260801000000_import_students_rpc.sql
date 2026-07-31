-- ============================================================================
-- Migration 20260801000000 — import_students RPC
-- Atomic bulk student import for the Admin module (students + enrollments).
-- Apply AFTER 20260731000000_schema_v2.sql.
--
-- Valid rows are imported; invalid rows are skipped and reported.
-- The whole call runs in one transaction, so a CSV import can never leave a
-- half-written batch behind (if the function itself raises, nothing persists).
-- ============================================================================

create or replace function public.import_students(p_year_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_class_id uuid;
  v_student  uuid;
  v_gender   text;
  v_dob      date;
  v_name     text;
  v_imported int := 0;
  v_errors   jsonb := '[]'::jsonb;
begin
  -- Admin only (RLS is bypassed inside security-definer functions, so the
  -- authorization check happens here).
  if public.my_role() <> 'admin' then
    raise exception 'Only admin can import students';
  end if;

  if not exists (select 1 from academic_years where id = p_year_id) then
    raise exception 'Academic year not found';
  end if;

  -- Expected p_rows element: {"full_name": "...", "class": "Year 3 Magenta",
  --                           "gender": "male"|"female"|null, "date_of_birth": "YYYY-MM-DD"|null}
  for r in
    select t.idx, t.row from jsonb_array_elements(p_rows) with ordinality as t(row, idx)
  loop
    v_name := btrim(coalesce(r.row ->> 'full_name', ''));

    -- full_name is required
    if v_name = '' then
      v_errors := v_errors || jsonb_build_object('row', r.idx, 'error', 'Missing full_name');
      continue;
    end if;

    -- class must exist in the target year (name match, case-insensitive)
    select c.id into v_class_id
    from classes c
    where c.academic_year_id = p_year_id
      and lower(c.class_name) = lower(btrim(coalesce(r.row ->> 'class', '')))
    limit 1;
    if v_class_id is null then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name,
        'error', 'Class not found: "' || coalesce(r.row ->> 'class', '') || '"');
      continue;
    end if;

    -- gender optional, must be male/female when present
    v_gender := nullif(lower(btrim(coalesce(r.row ->> 'gender', ''))), '');
    if v_gender is not null and v_gender not in ('male', 'female') then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Invalid gender (use male/female)');
      continue;
    end if;

    -- date_of_birth optional, must parse as a date
    begin
      v_dob := nullif(btrim(coalesce(r.row ->> 'date_of_birth', '')), '')::date;
    exception when others then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Invalid date_of_birth (use YYYY-MM-DD)');
      continue;
    end;

    -- duplicate guard: same name already enrolled in the same class + year
    if exists (
      select 1
      from enrollments e
      join students s on s.id = e.student_id
      where e.academic_year_id = p_year_id
        and e.class_id = v_class_id
        and lower(s.full_name) = lower(v_name)
    ) then
      v_errors := v_errors || jsonb_build_object(
        'row', r.idx, 'name', v_name, 'error', 'Duplicate — already enrolled in this class');
      continue;
    end if;

    insert into students (full_name, gender, date_of_birth)
    values (v_name, v_gender, v_dob)
    returning id into v_student;

    insert into enrollments (student_id, class_id, academic_year_id)
    values (v_student, v_class_id, p_year_id);

    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end;
$$;
