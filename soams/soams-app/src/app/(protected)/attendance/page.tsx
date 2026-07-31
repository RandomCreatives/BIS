import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import {
  isValidISODate,
  isWeekend,
  prettyDate,
  shiftISODate,
  todayISO,
} from '@/lib/config';
import {
  AttendanceGrid,
  type AttStatus,
  type GridStudent,
  type TermSummary,
} from './attendance-grid';

const MODULE_ROLES = new Set(['admin', 'principal', 'main_teacher', 'assistant_teacher']);

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  mainTeacherId: string | null;
  assistantTeacherId: string | null;
}

interface YearRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface TermRow {
  term_number: number;
  start_date: string;
  end_date: string;
  locked_at: string | null;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;

  if (!MODULE_ROLES.has(profile.role)) {
    return (
      <Notice
        title="Not authorized"
        body="The attendance module is available to Main Teachers, Assistant Teachers, Admin and the Principal."
      />
    );
  }

  const supabase = await createClient();

  // --- current academic year ---
  const { data: yearRow } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date')
    .eq('is_current', true)
    .single();
  const year = (yearRow as YearRow | null) ?? null;
  if (!year) {
    return (
      <Notice
        title="No current academic year"
        body="Ask the administrator to create the academic year and its three terms first (Administration module)."
      />
    );
  }

  // --- classes this user may work with ---
  let classQuery = supabase
    .from('classes')
    .select('id, class_name, main_teacher_id, assistant_teacher_id, grade_levels(name)')
    .eq('academic_year_id', year.id);
  if (profile.role !== 'admin' && profile.role !== 'principal') {
    classQuery = classQuery.or(
      `main_teacher_id.eq.${user.id},assistant_teacher_id.eq.${user.id}`,
    );
  }
  const { data: classRows } = await classQuery;

  const classes: ClassOption[] = (classRows ?? [])
    .map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const gl = r.grade_levels as { name?: string } | { name?: string }[] | null;
      const grade = Array.isArray(gl) ? (gl[0]?.name ?? '') : (gl?.name ?? '');
      return {
        id: String(r.id),
        name: String(r.class_name),
        grade,
        mainTeacherId: (r.main_teacher_id as string | null) ?? null,
        assistantTeacherId: (r.assistant_teacher_id as string | null) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (classes.length === 0) {
    return (
      <Notice
        title="No classes assigned"
        body={`${year.name}: you are not listed as a main or assistant teacher for any class. Ask the administrator to update class assignments.`}
      />
    );
  }

  // --- selection: class + date ---
  let selectedId =
    params.class && classes.some((c) => c.id === params.class) ? params.class : null;
  // Single-class teachers land directly on their register.
  if (!selectedId && classes.length === 1) selectedId = classes[0].id;

  const today = todayISO();
  let date = params.date && isValidISODate(params.date) ? params.date : today;
  if (date < year.start_date) date = year.start_date;
  if (date > year.end_date) date = year.end_date;

  // ================= overview (user has several classes, none picked) =================
  if (!selectedId) {
    const ids = classes.map((c) => c.id);
    const [{ data: enrRows }, { data: todayRows }] = await Promise.all([
      supabase.from('enrollments').select('class_id').in('class_id', ids).is('left_on', null),
      supabase.from('daily_attendance').select('class_id').in('class_id', ids).eq('date', today),
    ]);
    const enrolled = countBy(enrRows ?? [], 'class_id');
    const marked = countBy(todayRows ?? [], 'class_id');

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Attendance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {year.name} · Today is {prettyDate(today)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const total = enrolled[c.id] ?? 0;
            const done = marked[c.id] ?? 0;
            const state =
              total === 0
                ? { text: 'No students enrolled', cls: 'text-slate-500' }
                : done >= total
                  ? { text: `Complete — ${done}/${total} marked`, cls: 'text-emerald-600' }
                  : done > 0
                    ? { text: `In progress — ${done}/${total} marked`, cls: 'text-amber-600' }
                    : { text: `Not started — 0/${total} marked`, cls: 'text-slate-500' };
            return (
              <Link
                key={c.id}
                href={`/attendance?class=${c.id}&date=${today}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <h3 className="font-semibold text-slate-900">{c.name}</h3>
                <p className="text-xs text-slate-500">{c.grade}</p>
                <p className={`mt-3 text-sm font-semibold ${state.cls}`}>{state.text}</p>
                <p className="mt-1 text-xs text-slate-400">Tap to open today&apos;s register →</p>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // ================= register grid for one class + date =================
  const klass = classes.find((c) => c.id === selectedId)!;

  const { data: enrollmentRows } = await supabase
    .from('enrollments')
    .select('student:students(id, full_name)')
    .eq('class_id', selectedId)
    .is('left_on', null);

  const students: GridStudent[] = (enrollmentRows ?? [])
    .map((row) => {
      const s = Array.isArray(row.student) ? row.student[0] : row.student;
      const st = s as { id: string; full_name: string } | null;
      return st ? { id: st.id, name: st.full_name } : null;
    })
    .filter((s): s is GridStudent => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: markRows } = await supabase
    .from('daily_attendance')
    .select('student_id, status')
    .eq('class_id', selectedId)
    .eq('date', date);
  const initialStatuses: Record<string, AttStatus> = {};
  for (const m of markRows ?? []) {
    initialStatuses[m.student_id as string] = m.status as AttStatus;
  }

  // --- term context + per-student term totals (FR-2.3 preview) ---
  const { data: termRows } = await supabase
    .from('terms')
    .select('term_number, start_date, end_date, locked_at')
    .eq('academic_year_id', year.id)
    .order('term_number');
  const terms = (termRows ?? []) as TermRow[];
  const term = terms.find((t) => t.start_date <= date && date <= t.end_date) ?? null;

  const summary: Record<string, TermSummary> = {};
  let schoolDays = 0;
  if (term) {
    const { data: hist } = await supabase
      .from('daily_attendance')
      .select('student_id, date, status')
      .eq('class_id', selectedId)
      .gte('date', term.start_date)
      .lte('date', term.end_date);
    const days = new Set<string>();
    for (const h of hist ?? []) {
      days.add(h.date as string);
      const sid = h.student_id as string;
      summary[sid] ??= { present: 0, absent: 0, late: 0, excused: 0 };
      summary[sid][h.status as AttStatus] += 1;
    }
    schoolDays = days.size;
  }

  const canEdit =
    profile.role === 'admin' ||
    klass.mainTeacherId === user.id ||
    klass.assistantTeacherId === user.id;

  const prevDay = shiftISODate(date, -1);
  const nextDay = shiftISODate(date, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{klass.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {year.name} · {klass.grade}
            {term
              ? ` · Term ${term.term_number} (${schoolDays} school day${schoolDays === 1 ? '' : 's'} marked)`
              : ' · outside term dates'}
          </p>
        </div>
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/attendance?class=${c.id}&date=${date}`}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  c.id === selectedId
                    ? 'bg-brand-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:border-brand-400'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <NavButton href={`/attendance?class=${selectedId}&date=${prevDay}`} disabled={date <= year.start_date}>
          ← Prev
        </NavButton>
        <form action="/attendance" method="get" className="flex items-center gap-2">
          <input type="hidden" name="class" value={selectedId} />
          <input
            type="date"
            name="date"
            defaultValue={date}
            min={year.start_date}
            max={year.end_date}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go
          </button>
        </form>
        <NavButton href={`/attendance?class=${selectedId}&date=${nextDay}`} disabled={date >= year.end_date}>
          Next →
        </NavButton>
        {date !== today && (
          <Link
            href={`/attendance?class=${selectedId}&date=${today}`}
            className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
          >
            Jump to today
          </Link>
        )}
        <span className="ml-auto text-sm font-medium text-slate-700">{prettyDate(date)}</span>
      </div>

      {isWeekend(date) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ {prettyDate(date)} is a weekend — double-check the date before saving.
        </div>
      )}
      {!term && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ This date falls outside the term calendar — marks won&apos;t count toward term totals
          on certificates.
        </div>
      )}
      {!canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          👁️ Read-only view — only the class main/assistant teacher (or Admin) can edit this
          register.
        </div>
      )}

      {students.length === 0 ? (
        <Notice
          title="No students enrolled"
          body={`${klass.name} has no active enrollments yet. The administrator enrolls students from the Administration module.`}
        />
      ) : (
        <AttendanceGrid
          key={`${selectedId}:${date}`}
          classId={selectedId}
          date={date}
          students={students}
          initialStatuses={initialStatuses}
          summary={summary}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function countBy(rows: Record<string, unknown>[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key]);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function NavButton({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{body}</p>
    </div>
  );
}
