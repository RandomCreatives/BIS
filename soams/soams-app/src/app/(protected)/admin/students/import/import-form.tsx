'use client';

import { useMemo, useState, useTransition } from 'react';
import { importStudents, type ImportResult } from '../actions';

// CSV import wizard: paste (or upload) → client-side preview with validation
// badges → server re-validates and imports atomically via the RPC.

interface ParsedRow {
  n: number; // spreadsheet row number (1-based, header excluded)
  full_name: string;
  class: string;
  gender: string;
  date_of_birth: string;
  problems: string[];
}

function parseCsvLine(line: string): string[] {
  // Minimal RFC-4180-ish parser: quoted fields, escaped quotes.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function ImportForm({ classNames }: { classNames: string[] }) {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const classSet = useMemo(
    () => new Set(classNames.map((c) => c.toLowerCase())),
    [classNames],
  );

  const rows: ParsedRow[] = useMemo(() => {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return [];

    // Optional header row: "name, class, gender, dob" in any casing/order.
    let start = 0;
    let colIdx = { name: 0, cls: 1, gender: 2, dob: 3 };
    const first = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
    if (first.some((c) => c.includes('name') || c.includes('class'))) {
      start = 1;
      const find = (alts: string[], fallback: number) => {
        const i = first.findIndex((c) => alts.some((a) => c.includes(a)));
        return i === -1 ? fallback : i;
      };
      colIdx = {
        name: find(['name'], 0),
        cls: find(['class'], 1),
        gender: find(['gender', 'sex'], 2),
        dob: find(['birth', 'dob', 'date'], 3),
      };
    }

    const out: ParsedRow[] = [];
    for (let i = start; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const r: ParsedRow = {
        n: i + 1,
        full_name: cells[colIdx.name] ?? '',
        class: cells[colIdx.cls] ?? '',
        gender: cells[colIdx.gender] ?? '',
        date_of_birth: cells[colIdx.dob] ?? '',
        problems: [],
      };
      if (!r.full_name) r.problems.push('missing name');
      if (!r.class) r.problems.push('missing class');
      else if (!classSet.has(r.class.toLowerCase())) r.problems.push(`unknown class “${r.class}”`);
      if (r.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth))
        r.problems.push('dob must be YYYY-MM-DD');
      out.push(r);
    }
    return out;
  }, [raw, classSet]);

  const validRows = rows.filter((r) => r.problems.length === 0);
  const invalidCount = rows.length - validRows.length;

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setResult(null); setRaw(String(reader.result ?? '')); };
    reader.readAsText(file);
  }

  function runImport() {
    setResult(null);
    startTransition(async () => {
      const res = await importStudents(
        validRows.map(({ full_name, class: cls, gender, date_of_birth }) => ({
          full_name, class: cls, gender, date_of_birth,
        })),
      );
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">1. Paste CSV or choose a file</h2>
            <p className="mt-1 text-sm text-slate-600">
              Column order: <code className="rounded bg-slate-100 px-1 font-mono text-xs">Full name, Class, Gender (optional), Date of birth (optional)</code>.
              A header row is auto-detected. Gender accepts m/f/male/female. Dates must be YYYY-MM-DD.
            </p>
          </div>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Choose .csv file
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
          </label>
        </div>
        <textarea
          value={raw}
          onChange={(e) => { setResult(null); setRaw(e.target.value); }}
          rows={7}
          placeholder={'Full name,Class,Gender,Date of birth\nSara Tesfaye,Year 3 Magenta,F,2017-05-04\nDagmawi Alemu,Year 3 Magenta,M,'}
          className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            2. Preview — {validRows.length} ready
            {invalidCount > 0 && <span className="text-red-600"> · {invalidCount} with problems</span>}
          </h2>
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Gender</th>
                  <th className="px-3 py-2">DoB</th>
                  <th className="px-3 py-2">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.n} className={r.problems.length ? 'bg-red-50' : ''}>
                    <td className="px-3 py-1.5 tabular-nums text-slate-400">{r.n}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{r.full_name || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.class || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.gender || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.date_of_birth || '—'}</td>
                    <td className="px-3 py-1.5">
                      {r.problems.length === 0 ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">{r.problems.join(' · ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Problem rows are skipped and reported — valid rows still import.
            </p>
            <button
              type="button"
              onClick={runImport}
              disabled={pending || validRows.length === 0}
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Importing…' : `Import ${validRows.length} students`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className={`font-semibold ${result.ok ? 'text-emerald-900' : 'text-red-800'}`}>
            {result.message}
          </p>
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-slate-500">row {e.row}</span>{' '}
                  {e.name && <span className="font-medium">{e.name}</span>} — {e.error}
                </li>
              ))}
            </ul>
          )}
          {result.ok && (
            <p className="mt-3 text-sm text-slate-600">
              Fix problem rows in your file and re-import — re-imports are safe
              (duplicates are skipped automatically).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
