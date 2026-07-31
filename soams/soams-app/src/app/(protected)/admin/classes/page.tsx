import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { MessageBanner, PageHeader } from '@/components/forms';

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  if (!year) {
    return (
      <div className="space-y-4">
        <PageHeader title="Classes" />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No current academic year — create one under{' '}
          <Link href="/admin/calendar" className="font-semibold underline">Academic Calendar</Link> first.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: classRows } = await supabase
    .from('classes')
    .select(
      'id, class_name, grade_levels(name, sort_order), main:profiles!main_teacher_id(full_name), asst:profiles!assistant_teacher_id(full_name)',
    )
    .eq('academic_year_id', year.id)
    .order('class_name');

  const { data: enrRows } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('academic_year_id', year.id)
    .is('left_on', null);
  const enrolled: Record<string, number> = {};
  for (const e of enrRows ?? []) {
    const k = e.class_id as string;
    enrolled[k] = (enrolled[k] ?? 0) + 1;
  }

  const rows = (classRows ?? []).map((c) => {
    const gl = Array.isArray(c.grade_levels) ? c.grade_levels[0] : c.grade_levels;
    const main = Array.isArray(c.main) ? c.main[0] : c.main;
    const asst = Array.isArray(c.asst) ? c.asst[0] : c.asst;
    return {
      id: c.id as string,
      name: c.class_name as string,
      grade: (gl as { name?: string; sort_order?: number } | null)?.name ?? '—',
      sort: (gl as { sort_order?: number } | null)?.sort_order ?? 99,
      main: (main as { full_name?: string } | null)?.full_name ?? null,
      asst: (asst as { full_name?: string } | null)?.full_name ?? null,
      students: enrolled[c.id as string] ?? 0,
    };
  }).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Classes"
        subtitle={`${year.name} · ${rows.length} classes`}
        action={
          <Link
            href="/admin/classes/new"
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            + New class
          </Link>
        }
      />
      <MessageBanner params={params} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Main teacher</th>
              <th className="px-4 py-3">Assistant</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.grade}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600">{c.students}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {c.main ?? <span className="text-amber-600">⚠ unassigned</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.asst ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/classes/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No classes yet for {year.name} — create the year&apos;s 12 classes, then enroll students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Classes are scoped to the academic year — next September you&apos;ll create {year.name}&apos;s
        successor and assign teachers again (~15 min, see the rollover checklist in SCHEMA_V2_NOTES.md).
      </p>
    </div>
  );
}
