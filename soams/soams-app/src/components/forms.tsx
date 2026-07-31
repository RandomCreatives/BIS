// Shared form styling + feedback primitives for the admin CRUD pages.

export const inputCls =
  'w-full rounded-lg border border-line bg-bone px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

export const selectCls = inputCls;

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink/80">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 font-mono text-[11px] text-ink/50">{hint}</p>}
    </div>
  );
}

/** Reads ?ok=&msg= from the URL and renders a success/error banner.
 *  Admin server actions redirect back with these params after mutations. */
export function MessageBanner({ params }: { params: { ok?: string; msg?: string } }) {
  if (!params.msg) return null;
  const ok = params.ok === '1';
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
      role="status"
    >
      {params.msg}
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
