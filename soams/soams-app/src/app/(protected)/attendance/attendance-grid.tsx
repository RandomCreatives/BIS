'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { saveAttendance } from './actions';

export type AttStatus = 'present' | 'absent' | 'late' | 'excused';

export interface TermSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface GridStudent {
  id: string;
  name: string;
}

const STATUS_META: {
  value: AttStatus;
  letter: string;
  label: string;
  activeClass: string;
}[] = [
  { value: 'present', letter: 'P', label: 'Present', activeClass: 'border-emerald-600 bg-emerald-600 text-white' },
  { value: 'late', letter: 'L', label: 'Late', activeClass: 'border-amber-500 bg-amber-500 text-white' },
  { value: 'absent', letter: 'A', label: 'Absent', activeClass: 'border-red-600 bg-red-600 text-white' },
  { value: 'excused', letter: 'E', label: 'Excused', activeClass: 'border-sky-600 bg-sky-600 text-white' },
];

export function AttendanceGrid(props: {
  classId: string;
  date: string;
  students: GridStudent[];
  initialStatuses: Record<string, AttStatus>;
  summary: Record<string, TermSummary>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>(props.initialStatuses);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Remount-safe key: the page passes key={classId:date}, so switching
  // class/date always starts from fresh server data. After a save,
  // router.refresh() updates initialStatuses and dirtiness clears itself.
  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(statuses), ...Object.keys(props.initialStatuses)]);
    for (const k of keys) {
      if ((statuses[k] ?? null) !== (props.initialStatuses[k] ?? null)) return true;
    }
    return false;
  }, [statuses, props.initialStatuses]);

  // Warn before closing/refreshing with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const markedCount = useMemo(
    () => props.students.filter((s) => statuses[s.id]).length,
    [props.students, statuses],
  );

  function mark(studentId: string, status: AttStatus) {
    if (!props.canEdit) return;
    setFeedback(null);
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    if (!props.canEdit) return;
    setFeedback(null);
    setStatuses(() => {
      const next: Record<string, AttStatus> = {};
      for (const s of props.students) next[s.id] = 'present';
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const records = props.students
        .filter((s) => statuses[s.id])
        .map((s) => ({ studentId: s.id, status: statuses[s.id] as string }));
      const res = await saveAttendance({ classId: props.classId, date: props.date, records });
      setFeedback(
        res.ok
          ? { ok: true, text: `Register saved — ${res.saved} mark${res.saved === 1 ? '' : 's'} for ${props.date}.` }
          : { ok: false, text: res.message },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      {/* Legend + quick action */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {STATUS_META.map((m) => `${m.letter} = ${m.label}`).join(' · ')}
        </p>
        {props.canEdit && (
          <button
            type="button"
            onClick={markAllPresent}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            ✓ Mark all present
          </button>
        )}
      </div>

      {/* Roster */}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {props.students.map((s, idx) => {
          const current = statuses[s.id];
          const sum = props.summary[s.id];
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden w-6 text-right text-xs tabular-nums text-slate-400 sm:inline">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {sum
                      ? `Term: ${sum.present}P · ${sum.late}L · ${sum.absent}A · ${sum.excused}E`
                      : 'No marks yet this term'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {STATUS_META.map((m) => {
                  const isActive = current === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      disabled={!props.canEdit}
                      onClick={() => mark(s.id, m.value)}
                      aria-label={`${s.name}: ${m.label}`}
                      aria-pressed={isActive}
                      className={`h-10 w-10 rounded-lg border text-sm font-bold transition sm:h-9 sm:w-9 ${
                        isActive
                          ? m.activeClass
                          : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600'
                      } ${props.canEdit ? '' : 'cursor-default opacity-80'}`}
                    >
                      {m.letter}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky action bar — thumb-friendly at the bottom of the phone screen */}
      <div className="sticky bottom-2 mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold tabular-nums">
              {markedCount}/{props.students.length}
            </span>{' '}
            marked
            {dirty && <span className="ml-2 font-semibold text-amber-600">• unsaved changes</span>}
          </p>
          {props.canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty || markedCount === 0}
              className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save register'}
            </button>
          )}
        </div>
        {feedback && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-sm ${
              feedback.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
