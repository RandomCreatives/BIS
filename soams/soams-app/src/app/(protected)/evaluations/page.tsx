import { ExcelEvaluationGrid } from '@/components/excel-evaluation-grid';

export default function EvaluationsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Standards Marksheet
          </h1>
          <p className="mt-1 font-mono text-xs text-ink/55">
            WT · WW · WA bulk entry — arrow keys, Enter to cycle, Del to clear
          </p>
        </div>
        <span className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink/60">
          Phase 2
        </span>
      </div>

      <ExcelEvaluationGrid />

      <p className="font-mono text-[11px] text-ink/45">
        {'// sample criteria above — the live grid will load real term_criteria rows for your assigned subjects (RLS already scopes them). Drafts persist in this browser until the Phase 2 save path ships.'}
      </p>
    </div>
  );
}
