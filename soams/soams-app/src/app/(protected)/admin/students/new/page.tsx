import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { MessageBanner, PageHeader } from '@/components/forms';
import { StudentForm } from '../student-form';

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  const supabase = await createClient();

  const [{ data: classRows }, { data: snRows }] = await Promise.all([
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
        title="Register student"
        subtitle={year ? `Enrollment applies to ${year.name}` : 'No current academic year set.'}
        action={
          <Link href="/admin/students" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All students
          </Link>
        }
      />
      <MessageBanner params={params} />
      <StudentForm
        classes={(classRows ?? []).map((c) => ({ id: c.id as string, name: c.class_name as string }))}
        snTeachers={(snRows ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
      />
    </div>
  );
}
