'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(path: string, ok: boolean, msg: string): never {
  redirect(`${path}?ok=${ok ? '1' : '0'}&msg=${encodeURIComponent(msg)}`);
}

export async function addAssignment(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back('/admin/assignments', false, 'Admin access required.');

  const classId = String(formData.get('class_id') ?? '');
  const subjectId = String(formData.get('subject_id') ?? '');
  const teacherId = String(formData.get('teacher_id') ?? '');
  const path = `/admin/assignments?class=${classId}`;

  if (!UUID_RE.test(classId) || !UUID_RE.test(subjectId) || !UUID_RE.test(teacherId)) {
    back('/admin/assignments', false, 'Please choose class, subject and teacher.');
  }

  const supabase = await createClient();

  // The subjects UI is role-scoped; verify the picked teacher really is a subject teacher.
  const { data: teacher } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', teacherId)
    .single();
  if (!teacher || (teacher.role as string) !== 'subject_teacher') {
    back(path, false, 'Assignments require a staff member with the Subject Teacher role.');
  }
  if (!teacher.is_active) back(path, false, `${teacher.full_name}'s account is deactivated.`);

  const { error } = await supabase
    .from('teaching_assignments')
    .insert({ teacher_id: teacherId, subject_id: subjectId, class_id: classId });

  if (error) {
    back(path, false, error.message.includes('teaching_assignments_teacher_id_subject_id_class_id_key')
      ? `${teacher.full_name} already has that subject in this class.`
      : `Could not add assignment: ${error.message}`);
  }
  back(path, true, `Assigned ${teacher.full_name}.`);
}

export async function removeAssignment(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back('/admin/assignments', false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  const path = `/admin/assignments?class=${classId}`;
  if (!UUID_RE.test(id)) back(path, false, 'Invalid assignment.');

  const supabase = await createClient();
  const { error } = await supabase.from('teaching_assignments').delete().eq('id', id);
  if (error) back(path, false, `Could not remove: ${error.message}`);
  back(path, true, 'Assignment removed.');
}
