import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { MessageBanner, PageHeader, inputCls } from '@/components/forms';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  transferred: 'bg-amber-50 text-amber-700',
  graduated: 'bg-slate-100 text-slate-600',
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  const supabase = await createClient();

  const q = (params.q ?? '').trim();
  let query = supabase
    .from('students')
    .select(
      'id, full_name, gender, date_of_birth, is_special_needs, status, enrollments(class_id, classes(class_name))',
    )
    .order('full_name')
    .limit(300);
  if (year) query = query.eq('enrollments.academic_year_id', year.id);
  if (q) query = query.ilike('full_name', `%${q}%`);
  const { data } = await query;

  const rows = (data ?? []).map((s) => {
    const enr = Array.isArray(s.enrollments) ? s.enrollments[0] : null;
    const cls = enr && !Array.isArray(enr.classes) ? (enr.classes as { class_name: string } | null) : null;
    return {
      id: s.id as string,
      full_name: s.full_name as string,
      gender: s.gender as string | null,
      is_special_needs: s.is_special_needs as boolean,
      status: s.status as string,
      className: cls?.class_name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        subtitle={year ? `Enrollments shown for ${year.name}` : undefined}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/students/import"
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              ⬆ CSV Import
            </Link>
            <Link
              href="/admin/students/new"
              className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              + Add student
            </Link>
          </div>
        }
      />

      <MessageBanner params={params} />

      <form action="/admin/students" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className={`${inputCls} max-w-xs`}
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
        {q && (
          <Link href="/admin/students" className="self-center text-sm text-slate-500 hover:underline">
            clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {s.full_name}
                  {s.is_special_needs && (
                    <span
                      className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700"
                      title="Special Needs — has an assigned SN teacher and private IEP log"
                    >
                      SN
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{s.className ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2.5 capitalize text-slate-600">{s.gender ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/students/${s.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {q ? `No students match “${q}”.` : 'No students registered yet — use CSV Import for the first batch.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length >= 300 && (
        <p className="text-xs text-slate-500">Showing first 300 results — use search to narrow down.</p>
      )}
    </div>
  );
}
