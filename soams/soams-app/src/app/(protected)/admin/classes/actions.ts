'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, getCurrentYear } from '@/lib/data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(path: string, ok: boolean, msg: string): never {
  redirect(`${path}?ok=${ok ? '1' : '0'}&msg=${encodeURIComponent(msg)}`);
}

export async function upsertClass(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back('/admin/classes', false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  const isNew = id === '';
  const formPath = isNew ? '/admin/classes/new' : `/admin/classes/${id}`;

  const className = String(formData.get('class_name') ?? '').trim();
  const gradeLevelId = String(formData.get('grade_level_id') ?? '');
  const mainTeacherId = String(formData.get('main_teacher_id') ?? '') || null;
  const assistantTeacherId = String(formData.get('assistant_teacher_id') ?? '') || null;

  if (!isNew && !UUID_RE.test(id)) back('/admin/classes', false, 'Invalid class.');
  if (!className) back(formPath, false, 'Class name is required.');
  if (className.length > 50) back(formPath, false, 'Class name is too long (max 50 chars).');
  if (!UUID_RE.test(gradeLevelId)) back(formPath, false, 'Please choose a grade level.');
  if (mainTeacherId && !UUID_RE.test(mainTeacherId)) back(formPath, false, 'Invalid main teacher.');
  if (assistantTeacherId && !UUID_RE.test(assistantTeacherId)) back(formPath, false, 'Invalid assistant teacher.');
  if (mainTeacherId && mainTeacherId === assistantTeacherId)
    back(formPath, false, 'Main and assistant teacher must be different people.');

  const year = await getCurrentYear();
  if (!year) back(formPath, false, 'No current academic year.');

  const supabase = await createClient();

  const selectedTeacherIds = [mainTeacherId, assistantTeacherId].filter(
    (teacherId): teacherId is string => teacherId !== null,
  );
  if (selectedTeacherIds.length > 0) {
    const { data: selectedTeachers, error: teacherError } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .in('id', selectedTeacherIds);
    if (teacherError) back(formPath, false, 'Could not verify the selected teachers.');

    const byId = new Map((selectedTeachers ?? []).map((teacher) => [teacher.id, teacher]));
    const main = mainTeacherId ? byId.get(mainTeacherId) : null;
    const assistant = assistantTeacherId ? byId.get(assistantTeacherId) : null;
    if (mainTeacherId && (!main || main.role !== 'main_teacher' || !main.is_active)) {
      back(formPath, false, 'The selected main teacher is not active in that role.');
    }
    if (
      assistantTeacherId &&
      (!assistant || assistant.role !== 'assistant_teacher' || !assistant.is_active)
    ) {
      back(formPath, false, 'The selected assistant teacher is not active in that role.');
    }
  }

  if (isNew) {
    const { error } = await supabase.from('classes').insert({
      class_name: className,
      grade_level_id: gradeLevelId,
      academic_year_id: year.id,
      main_teacher_id: mainTeacherId,
      assistant_teacher_id: assistantTeacherId,
    });
    if (error) {
      back(formPath, false, error.message.includes('classes_class_name_academic_year_id_key')
        ? `A class named "${className}" already exists in ${year.name}.`
        : `Could not save class: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from('classes')
      .update({
        class_name: className,
        grade_level_id: gradeLevelId,
        main_teacher_id: mainTeacherId,
        assistant_teacher_id: assistantTeacherId,
      })
      .eq('id', id)
      .eq('academic_year_id', year.id)
      .select('id')
      .single();
    if (error) {
      back(formPath, false, error.message.includes('classes_class_name_academic_year_id_key')
        ? `A class named "${className}" already exists in ${year.name}.`
        : `Could not save class: ${error.message}`);
    }
  }

  back('/admin/classes', true, isNew ? `Class "${className}" created.` : `Class "${className}" updated.`);
}
