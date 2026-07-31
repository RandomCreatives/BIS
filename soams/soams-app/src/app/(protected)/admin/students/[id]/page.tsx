import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { MessageBanner, PageHeader } from '@/components/forms';
import { StudentForm } from '../student-form';

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, gender, date_of_birth, is_special_needs, assigned_special_teacher_id, status')
    .eq('id', id)
    .single();
  if (!student) notFound();

  const [{ data: enrollment }, { data: classRows }, { data: snRows }] = await Promise.all([
    year
      ? supabase
          .from('enrollments')
          .select('class_id')
          .eq('student_id', id)
          .eq('academic_year_id', year.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    year
      ? supabase.from('classes').select('id, class_name').eq('academic_year_id', year.id).order('class_name')
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'special_needs_teacher')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={`Edit — ${student.full_name}`}
        subtitle={year ? `Enrollment applies to ${year.name}` : undefined}
        action={
          <Link href="/admin/students" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All students
          </Link>
        }
      />
      <MessageBanner params={sp} />
      <StudentForm
        student={student as never}
        enrollmentClassId={(enrollment?.class_id as string | undefined) ?? ''}
        classes={(classRows ?? []).map((c) => ({ id: c.id as string, name: c.class_name as string }))}
        snTeachers={(snRows ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
      />
    </div>
  );
}
