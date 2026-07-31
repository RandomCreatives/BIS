import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { PageHeader } from '@/components/forms';
import { ImportForm } from './import-form';

export default async function ImportStudentsPage() {
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  const supabase = await createClient();
  const { data: classRows } = year
    ? await supabase.from('classes').select('class_name').eq('academic_year_id', year.id).order('class_name')
    : { data: [] };

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="CSV Student Import"
        subtitle={
          year
            ? `Importing into ${year.name} · ${(classRows ?? []).length} classes available: ${(classRows ?? [])
                .map((c) => c.class_name)
                .join(', ')}`
            : '⚠ Create an academic year and classes first.'
        }
        action={
          <Link href="/admin/students" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All students
          </Link>
        }
      />
      <ImportForm classNames={(classRows ?? []).map((c) => c.class_name as string)} />
    </div>
  );
}
