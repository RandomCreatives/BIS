import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import { prettyDate } from '@/lib/config';
import { MessageBanner, PageHeader, Card, Field, inputCls } from '@/components/forms';
import { SubmitButton } from '@/components/submit-button';
import { createYear, setCurrentYear, setTermLocked } from './actions';

// Academic calendar: years, terms, and the term-lock switch that freezes
// standards-based evaluation entry at the end of each term.
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const supabase = await createClient();
  const { data: yearRows } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date, is_current, terms(id, term_number, start_date, end_date, locked_at)')
    .order('start_date', { ascending: false });

  const years = (yearRows ?? []).map((y) => ({
    id: y.id as string,
    name: y.name as string,
    start: y.start_date as string,
    end: y.end_date as string,
    isCurrent: y.is_current as boolean,
    terms: ((y.terms as never[]) ?? [])
      .map((t) => {
        const tr = t as Record<string, unknown>;
        return {
          id: tr.id as string,
          n: tr.term_number as number,
          start: tr.start_date as string,
          end: tr.end_date as string,
          locked: Boolean(tr.locked_at),
        };
      })
      .sort((a, b) => a.n - b.n),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Calendar"
        subtitle="Years, term dates, and term locking. Locking a term freezes evaluation entry for subject teachers."
      />
      <MessageBanner params={params} />

      <div className="grid gap-4">
        {years.map((y) => (
          <Card key={y.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {y.name}
                  {y.isCurrent && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      CURRENT
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-500">
                  {prettyDate(y.start)} → {prettyDate(y.end)}
                </p>
              </div>
              {!y.isCurrent && (
                <form action={setCurrentYear}>
                  <input type="hidden" name="id" value={y.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Set as current year
                  </button>
                </form>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {y.terms.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-4 ${
                    t.locked ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Term {t.n}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        t.locked ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {t.locked ? '🔒 locked' : 'open'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {prettyDate(t.start)} → {prettyDate(t.end)}
                  </p>
                  <form action={setTermLocked} className="mt-3">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="locked" value={t.locked ? '0' : '1'} />
                    <button
                      type="submit"
                      className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        t.locked
                          ? 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      {t.locked ? 'Unlock term' : 'Lock term'}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">Create academic year</h2>
        <p className="mt-1 text-sm text-slate-600">
          September rollover: create the year + terms, set it current, then create
          the year&apos;s classes and enrollments.
        </p>
        <form action={createYear} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Year name" required hint='e.g. "2027/2028"'>
              <input name="name" required maxLength={20} className={inputCls} placeholder="2027/2028" />
            </Field>
            <Field label="Year starts" required>
              <input type="date" name="start_date" required className={inputCls} />
            </Field>
            <Field label="Year ends" required>
              <input type="date" name="end_date" required className={inputCls} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Term {n}</p>
                <div className="mt-2 space-y-2">
                  <input type="date" name={`term${n}_start`} required className={inputCls} aria-label={`Term ${n} start`} />
                  <input type="date" name={`term${n}_end`} required className={inputCls} aria-label={`Term ${n} end`} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <SubmitButton>Create year + 3 terms</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
