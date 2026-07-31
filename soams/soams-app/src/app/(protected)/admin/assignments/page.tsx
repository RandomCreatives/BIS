import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext, getCurrentYear } from '@/lib/data';
import { MessageBanner, PageHeader, Card, selectCls } from '@/components/forms';
import { SubmitButton } from '@/components/submit-button';
import { addAssignment, removeAssignment } from './actions';

// Teaching assignments drive WHO MAY EVALUATE WHAT (schema v2 §2.3) —
// this page is effectively the permission editor for Phase 2.
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const year = await getCurrentYear();
  if (!year) {
    return (
      <div className="space-y-4">
        <PageHeader title="Teaching Assignments" />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Create an academic year first under{' '}
          <Link href="/admin/calendar" className="font-semibold underline">Academic Calendar</Link>.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: classRows } = await supabase
    .from('classes')
    .select('id, class_name')
    .eq('academic_year_id', year.id)
    .order('class_name');
  const classes = (classRows ?? []) as { id: string; class_name: string }[];
  const selectedId =
    params.class && classes.some((c) => c.id === params.class)
      ? params.class
      : (classes[0]?.id ?? null);
  const selected = classes.find((c) => c.id === selectedId);

  const [{ data: assignments }, { data: subjects }, { data: teachers }] = await Promise.all([
    selectedId
      ? supabase
          .from('teaching_assignments')
          .select('id, subjects(name), teacher:profiles!teacher_id(full_name)')
          .eq('class_id', selectedId)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('subjects').select('id, subject_name:name').eq('is_active', true).order('subject_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'subject_teacher')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teaching Assignments"
        subtitle={`${year.name} · which subject teacher teaches which subject in which class — this powers evaluation access (RLS)`}
      />
      <MessageBanner params={params} />

      {classes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No classes yet for {year.name} — create them first under{' '}
          <Link href="/admin/classes" className="font-semibold text-brand-700 underline">Classes</Link>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/admin/assignments?class=${c.id}`}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  c.id === selectedId
                    ? 'bg-brand-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:border-brand-400'
                }`}
              >
                {c.class_name}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-semibold text-slate-900">
                {selected?.class_name} — {assignments?.length ?? 0} assignment(s)
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {(assignments ?? []).map((a) => {
                  const subj = Array.isArray(a.subjects) ? a.subjects[0] : a.subjects;
                  const teacher = Array.isArray(a.teacher) ? a.teacher[0] : a.teacher;
                  return (
                    <li key={a.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {(subj as { name?: string } | null)?.name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(teacher as { full_name?: string } | null)?.full_name ?? '—'}
                        </p>
                      </div>
                      <form action={removeAssignment}>
                        <input type="hidden" name="id" value={String(a.id)} />
                        <input type="hidden" name="class_id" value={selectedId ?? ''} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  );
                })}
                {(assignments ?? []).length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-500">
                    No assignments yet — add subject teachers on the right.
                  </li>
                )}
              </ul>
            </Card>

            <Card>
              <h2 className="font-semibold text-slate-900">Add assignment to {selected?.class_name}</h2>
              <form action={addAssignment} className="mt-3 space-y-4">
                <input type="hidden" name="class_id" value={selectedId ?? ''} />
                <div>
                  <label className="block text-sm font-medium text-slate-700">Subject</label>
                  <select name="subject_id" required className={`${selectCls} mt-1`}>
                    <option value="" disabled selected>
                      — Choose subject —
                    </option>
                    {(subjects ?? []).map((s) => (
                      <option key={s.id as string} value={s.id as string}>
                        {s.subject_name as string}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Subject teacher</label>
                  <select name="teacher_id" required className={`${selectCls} mt-1`}>
                    <option value="" disabled selected>
                      — Choose teacher —
                    </option>
                    {(teachers ?? []).map((t) => (
                      <option key={t.id as string} value={t.id as string}>
                        {t.full_name as string}
                      </option>
                    ))}
                  </select>
                  {(teachers ?? []).length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No active Subject Teachers on staff yet — invite them first (see Staff page).
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <SubmitButton>Assign</SubmitButton>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
