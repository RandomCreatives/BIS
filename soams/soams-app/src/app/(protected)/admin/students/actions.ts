'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, getCurrentYear } from '@/lib/data';
import { isValidISODate } from '@/lib/config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STUDENT_STATUSES = new Set(['active', 'transferred', 'graduated']);

function back(path: string, ok: boolean, msg: string): never {
  redirect(`${path}?ok=${ok ? '1' : '0'}&msg=${encodeURIComponent(msg)}`);
}

function normalizeGender(raw: string): string | null {
  const g = raw.trim().toLowerCase();
  if (!g) return null;
  if (['m', 'male', 'boy'].includes(g)) return 'male';
  if (['f', 'female', 'girl'].includes(g)) return 'female';
  return null;
}

/** Create or update one student (+ their current-year enrollment). */
export async function upsertStudent(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back('/admin/students', false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  const isNew = id === '';
  const formPath = isNew ? '/admin/students/new' : `/admin/students/${id}`;

  const fullName = String(formData.get('full_name') ?? '').trim();
  const gender = normalizeGender(String(formData.get('gender') ?? ''));
  const dobRaw = String(formData.get('date_of_birth') ?? '').trim();
  const dob = dobRaw || null;
  const isSN = formData.get('is_special_needs') === 'on';
  const snTeacher = String(formData.get('assigned_special_teacher_id') ?? '').trim() || null;
  const status = String(formData.get('status') ?? 'active');
  const classId = String(formData.get('class_id') ?? '').trim() || null;

  if (!fullName) back(formPath, false, 'Full name is required.');
  if (fullName.length > 255) back(formPath, false, 'Full name is too long.');
  if (dob && !isValidISODate(dob)) back(formPath, false, 'Date of birth must be YYYY-MM-DD.');
  if (!STUDENT_STATUSES.has(status)) back(formPath, false, 'Invalid status.');
  if (snTeacher && !UUID_RE.test(snTeacher)) back(formPath, false, 'Invalid special-needs teacher.');
  if (classId && !UUID_RE.test(classId)) back(formPath, false, 'Invalid class.');

  const supabase = await createClient();
  const year = await getCurrentYear();
  if (!year) back(formPath, false, 'No current academic year — create one under Academic Calendar.');

  if (snTeacher && isSN) {
    const { data: t } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', snTeacher)
      .eq('role', 'special_needs_teacher')
      .single();
    if (!t) back(formPath, false, 'Assigned teacher must have the Special Needs Teacher role.');
  }

  const payload = {
    full_name: fullName,
    gender,
    date_of_birth: dob,
    is_special_needs: isSN,
    assigned_special_teacher_id: isSN ? snTeacher : null,
    status,
  };

  let studentId = id;
  if (isNew) {
    const { data, error } = await supabase.from('students').insert(payload).select('id').single();
    if (error) back(formPath, false, `Could not save student: ${error.message}`);
    studentId = data.id as string;
  } else {
    const { error } = await supabase.from('students').update(payload).eq('id', id);
    if (error) back(formPath, false, `Could not save student: ${error.message}`);
  }

  // Enrollment for the current year: one row per student per year
  // (UNIQUE(student_id, academic_year_id) — upsert moves class in place).
  if (classId) {
    const { error } = await supabase.from('enrollments').upsert(
      { student_id: studentId, class_id: classId, academic_year_id: year.id },
      { onConflict: 'student_id,academic_year_id' },
    );
    if (error) back(formPath, false, `Student saved, but enrollment failed: ${error.message}`);
  } else {
    await supabase
      .from('enrollments')
      .delete()
      .eq('student_id', studentId)
      .eq('academic_year_id', year.id);
  }

  back('/admin/students', true, isNew ? `${fullName} registered.` : `${fullName} updated.`);
}

export interface ImportRow {
  full_name: string;
  class: string;
  gender?: string;
  date_of_birth?: string;
}

export interface ImportResult {
  ok: boolean;
  message: string;
  imported?: number;
  errors?: { row: number; name?: string; error: string }[];
}

/** Bulk import via the atomic import_students RPC (see migration 20260801000000). */
export async function importStudents(rows: ImportRow[]): Promise<ImportResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: 'Admin access required.' };

  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: 'No rows to import.' };
  if (rows.length > 1000) return { ok: false, message: 'Import is limited to 1,000 rows at a time.' };

  // Sanitize: only expected keys, bounded strings, normalized gender.
  const clean = rows.slice(0, 1000).map((r) => ({
    full_name: String(r.full_name ?? '').slice(0, 255).trim(),
    class: String(r.class ?? '').slice(0, 100).trim(),
    gender: normalizeGender(String(r.gender ?? '')) ?? undefined,
    date_of_birth:
      r.date_of_birth && isValidISODate(String(r.date_of_birth).trim())
        ? String(r.date_of_birth).trim()
        : undefined,
  }));

  const nonEmpty = clean.filter((r) => r.full_name !== '');
  if (nonEmpty.length === 0) return { ok: false, message: 'Every row is missing a name.' };

  const year = await getCurrentYear();
  if (!year) return { ok: false, message: 'No current academic year.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_students', {
    p_year_id: year.id,
    p_rows: nonEmpty,
  });

  if (error) return { ok: false, message: `Import failed: ${error.message}` };

  const result = data as { imported: number; errors: { row: number; name?: string; error: string }[] };
  return {
    ok: true,
    message: `Imported ${result.imported} of ${nonEmpty.length} students into ${year.name}.`,
    imported: result.imported,
    errors: result.errors,
  };
}
