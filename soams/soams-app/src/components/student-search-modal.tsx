'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Printer, Loader2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';

interface StudentHit {
  id: string;
  full_name: string;
  class_name: string | null;
}

interface Summary {
  attendancePct: number | null;
  marks: { subject: string; attainment: string }[];
}

const ATTAINMENT_PILL: Record<string, string> = {
  WT: 'bg-wt-bg text-wt border-wt-line',
  WW: 'bg-ww-bg text-ww border-ww-line',
  WA: 'bg-wa-bg text-wa border-wa-line',
};

// Mounted only while open (parent gates it), so state starts fresh per search.
export function StudentSearchModal({
  currentYearId,
  onClose,
}: {
  currentYearId: string | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const configured = isSupabaseConfigured;
  const searching = configured && query.trim().length >= 2;
  const showHits = searching ? hits : [];

  // debounced student search (RLS-scoped: users only see who they may)
  useEffect(() => {
    if (!configured) return;
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const builder = supabase
        .from('students')
        .select(
          'id, full_name, enrollments(academic_year_id, classes!enrollments_class_id_academic_year_id_fkey(class_name))',
        )
        .ilike('full_name', `%${q}%`)
        .order('full_name')
        .limit(8);
      if (currentYearId) builder.eq('enrollments.academic_year_id', currentYearId);
      const { data } = await builder;
      if (cancelled) return;
      const rows: StudentHit[] = (data ?? [])
        .map((r) => {
          const enr = Array.isArray(r.enrollments) ? r.enrollments[0] : r.enrollments;
          const c = enr ? (Array.isArray(enr.classes) ? enr.classes[0] : enr.classes) : null;
          return {
            id: String(r.id),
            full_name: String(r.full_name),
            class_name: (c?.class_name as string | null) ?? null,
          };
        })
        .filter((r) => r.full_name);
      setHits(rows);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, configured, currentYearId]);

  async function loadSummary(s: StudentHit) {
    setSelected(s);
    setSummary(null);
    setSummaryLoading(true);
    try {
      const supabase = createClient();
      const [{ data: att }, { data: evals }] = await Promise.all([
        supabase.from('daily_attendance').select('status').eq('student_id', s.id),
        supabase
          .from('student_evaluations')
          .select('attainment, criteria:term_criteria(description)')
          .eq('student_id', s.id)
          .limit(12),
      ]);
      const total = att?.length ?? 0;
      const presentLike = (att ?? []).filter(
        (a) => a.status === 'present' || a.status === 'late',
      ).length;
      const marks: Summary['marks'] = (evals ?? [])
        .map((r) => {
          const c = Array.isArray(r.criteria) ? r.criteria[0] : r.criteria;
          return {
            subject: (c?.description as string | null) ?? 'Criterion',
            attainment: String(r.attainment),
          };
        })
        .filter((m) => m.attainment);
      setSummary({
        attendancePct: total > 0 ? Math.round((presentLike / total) * 100) : null,
        marks,
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search students"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* search field */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search students by name…"
            autoFocus
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink/40" />}
          <button
            onClick={onClose}
            aria-label="Close search"
            className="rounded-md border border-line p-1 text-ink/50 transition hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {!configured && (
          <p className="px-4 py-6 text-center text-xs text-ink/50">
            Supabase isn&apos;t configured — student search is unavailable.
          </p>
        )}

        {configured && query.trim().length < 2 && (
          <p className="px-4 py-6 text-center font-mono text-[11px] text-ink/45">
            Type at least 2 characters to search the roster.
          </p>
        )}

        {/* results / summary */}
        {searching && !selected && (
          <ul className="max-h-72 overflow-y-auto py-1">
            {showHits.length === 0 && !loading && (
              <li className="px-4 py-4 text-center text-xs text-ink/50">No students found.</li>
            )}
            {showHits.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => loadSummary(h)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-bone"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-bone text-ink/50">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {h.full_name}
                    </span>
                    <span className="block font-mono text-[10px] text-ink/50">
                      {h.class_name ?? 'no class assigned'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* quick summary overlay */}
        {selected && (
          <div className="border-t border-line bg-bone/50">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{selected.full_name}</p>
                <p className="font-mono text-[10px] text-ink/50">
                  {selected.class_name ?? 'no class'} · student summary
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink/60 transition hover:text-ink"
              >
                ← back
              </button>
            </div>

            {summaryLoading && (
              <p className="px-4 pb-4 text-center font-mono text-[11px] text-ink/45">
                loading…
              </p>
            )}

            {!summaryLoading && summary && (
              <div className="space-y-3 px-4 pb-4">
                <div className="rounded-lg border border-line bg-white p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink/45">
                    overall attendance
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-ink">
                    {summary.attendancePct === null ? '—' : `${summary.attendancePct}%`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-ww"
                      style={{ width: `${summary.attendancePct ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-white p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink/45">
                    subject progress
                  </p>
                  {summary.marks.length === 0 ? (
                    <p className="mt-1 text-xs text-ink/50">No evaluations entered yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {summary.marks.slice(0, 6).map((m, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-ink/75">{m.subject}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              ATTAINMENT_PILL[m.attainment] ?? 'bg-bone text-ink/60 border-line'
                            }`}
                          >
                            {m.attainment}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <a
                  href="/reports"
                  className="flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-bone transition hover:bg-ink/85"
                >
                  <Printer className="h-4 w-4" />
                  Print PDF Certificate
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
