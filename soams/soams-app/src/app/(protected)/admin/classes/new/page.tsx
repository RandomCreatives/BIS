import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import { MessageBanner, PageHeader } from '@/components/forms';
import { ClassForm } from '../class-form';

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const supabase = await createClient();
  const [{ data: grades }, { data: mains }, { data: assts }] = await Promise.all([
    supabase.from('grade_levels').select('id, name').order('sort_order'),
    supabase.from('profiles').select('id, full_name').eq('role', 'main_teacher').eq('is_active', true).order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'assistant_teacher').eq('is_active', true).order('full_name'),
  ]);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="New class"
        action={
          <Link href="/admin/classes" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All classes
          </Link>
        }
      />
      <MessageBanner params={params} />
      <ClassForm
        gradeLevels={(grades ?? []).map((g) => ({ id: g.id as string, name: g.name as string }))}
        mainTeachers={(mains ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
        assistantTeachers={(assts ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
      />
    </div>
  );
}
