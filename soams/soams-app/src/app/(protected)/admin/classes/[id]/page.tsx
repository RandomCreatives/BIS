import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import { MessageBanner, PageHeader } from '@/components/forms';
import { ClassForm } from '../class-form';

export default async function EditClassPage({
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

  const supabase = await createClient();
  const { data: klass } = await supabase
    .from('classes')
    .select('id, class_name, grade_level_id, color, main_teacher_id, assistant_teacher_id')
    .eq('id', id)
    .single();
  if (!klass) notFound();

  const [{ data: grades }, { data: mains }, { data: assts }] = await Promise.all([
    supabase.from('grade_levels').select('id, name').order('sort_order'),
    supabase.from('profiles').select('id, full_name').eq('role', 'main_teacher').eq('is_active', true).order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'assistant_teacher').eq('is_active', true).order('full_name'),
  ]);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={`Edit — ${klass.class_name}`}
        action={
          <Link href="/admin/classes" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All classes
          </Link>
        }
      />
      <MessageBanner params={sp} />
      <ClassForm
        klass={klass as never}
        gradeLevels={(grades ?? []).map((g) => ({ id: g.id as string, name: g.name as string }))}
        mainTeachers={(mains ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
        assistantTeachers={(assts ?? []).map((t) => ({ id: t.id as string, name: t.full_name as string }))}
      />
    </div>
  );
}
