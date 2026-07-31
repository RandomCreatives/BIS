'use client';

import { useEffect, useRef, useState } from 'react';
import { Table2 } from 'lucide-react';

// Excel-style bulk evaluation grid: arrow-key navigation, Enter cycles the
// WT/WW/WA pill, clickable cells, and a live auto-save indicator. Drafts are
// kept in localStorage until the Phase 2 persistence path is wired up.

const LEVELS = ['WT', 'WW', 'WA'] as const;
type Level = (typeof LEVELS)[number];

const PILL: Record<Level, string> = {
  WT: 'bg-wt-bg text-wt border-wt-line',
  WW: 'bg-ww-bg text-ww border-ww-line',
  WA: 'bg-wa-bg text-wa border-wa-line',
};

const SAMPLE_CRITERIA = [
  'Listens and responds to spoken language',
  'Reads grade-level texts with fluency',
  'Writes clearly for different purposes',
  'Applies concepts in practical tasks',
  'Works collaboratively in group activities',
];

const STORAGE_KEY = 'soams-marksheet-draft';

function nextLevel(l: Level | null): Level {
  if (!l) return 'WT';
  const i = LEVELS.indexOf(l);
  return LEVELS[(i + 1) % LEVELS.length];
}

export function ExcelEvaluationGrid() {
  const [values, setValues] = useState<Record<number, Level | null>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  });
  const [focused, setFocused] = useState({ r: 0, c: 0 });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const cellRefs = useRef<(HTMLButtonElement | null)[][]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ticking clock for the "Saved Xs ago" label
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function commit(r: number, lv: Level | null) {
    const next = { ...values, [r]: lv };
    setValues(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — ignore */
    }
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setLastSaved(Date.now());
      setSaving(false);
    }, 700);
  }

  function moveFocus(r: number, c: number) {
    const rr = Math.max(0, Math.min(SAMPLE_CRITERIA.length - 1, r));
    const cc = Math.max(0, Math.min(LEVELS.length - 1, c));
    setFocused({ r: rr, c: cc });
    cellRefs.current[rr]?.[cc]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const { r, c } = focused;
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (e.key === 'ArrowUp') moveFocus(r - 1, c);
      if (e.key === 'ArrowDown') moveFocus(r + 1, c);
      if (e.key === 'ArrowLeft') moveFocus(r, c - 1);
      if (e.key === 'ArrowRight') moveFocus(r, c + 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(r, nextLevel(values[r]));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      commit(r, null);
    } else if (['1', '2', '3'].includes(e.key)) {
      e.preventDefault();
      commit(r, LEVELS[Number(e.key) - 1]);
    }
  }

  const secondsAgo = lastSaved === null ? null : Math.max(0, Math.round((now - lastSaved) / 1000));

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      {/* sheet header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bone px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink/70">
          <Table2 className="h-4 w-4 text-brand-500" />
          Marksheet — Term 3 · English · Year 4
        </span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-ink/50">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              saving ? 'animate-pulse bg-amber-400' : 'bg-ww'
            }`}
            aria-hidden
          />
          {saving ? 'Saving…' : secondsAgo === null ? 'draft (not saved yet)' : `Saved ${secondsAgo}s ago`}
        </span>
      </div>

      {/* spreadsheet */}
      <div className="overflow-x-auto" tabIndex={0} onKeyDown={onKeyDown} role="grid" aria-label="Standards marksheet">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink/55">
              <th className="px-4 py-2.5 font-semibold">
                <span className="text-ink/30">A ·</span> criterion
              </th>
              {LEVELS.map((l, i) => (
                <th key={l} className="px-2 py-2.5 text-center font-semibold">
                  <span className="text-ink/30">{String.fromCharCode(66 + i)} ·</span> {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_CRITERIA.map((c, r) => (
              <tr key={c} className={r % 2 ? 'bg-bone/50' : ''}>
                <td className="border-t border-line/70 px-4 py-2 text-ink/80">{c}</td>
                {LEVELS.map((l, c) => {
                  const active = values[r] === l;
                  return (
                    <td key={l} className="border-t border-line/70 px-2 py-2 text-center">
                      <button
                        ref={(el) => {
                          cellRefs.current[r] = cellRefs.current[r] ?? [];
                          cellRefs.current[r][c] = el;
                        }}
                        onClick={() => commit(r, active ? null : l)}
                        onFocus={() => setFocused({ r, c })}
                        aria-label={`${c}. ${l} — ${active ? 'selected' : 'unselected'}`}
                        className={`h-7 w-10 rounded-md border text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 ${
                          active
                            ? `${PILL[l]} border`
                            : 'border-line bg-white text-transparent hover:border-ink/40 hover:text-ink/30'
                        }`}
                      >
                        {l}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* legend + key hints */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-bone px-4 py-2.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink/55">
          <span><span className="font-bold text-wt">WT</span> = Working Towards</span>
          <span><span className="font-bold text-ww">WW</span> = Working Within</span>
          <span><span className="font-bold text-wa">WA</span> = Working Above</span>
        </div>
        <div className="hidden font-mono text-[10px] text-ink/45 sm:block">
          arrows · move &nbsp; enter · cycle &nbsp; del · clear &nbsp; 1/2/3 · set
        </div>
      </div>
    </div>
  );
}
