import { getModule } from '@/lib/roles';
import { getCurrentContext } from '@/lib/data';
import { notFound } from 'next/navigation';

// Shared scaffold body for module pages that are built in later phases.
// Shows exactly which schema objects back the module — so anyone picking up
// the code knows the data layer is already designed and migrated.
export async function ModulePlaceholder({ slug }: { slug: string }) {
  const mod = getModule(slug);
  if (!mod) notFound();

  const { profile } = await getCurrentContext();

  // Defense-in-depth: nav is already role-filtered; this guards direct URLs.
  // (Postgres RLS remains the final enforcement layer.)
  if (profile && !mod.roles.includes(profile.role)) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="font-display text-lg font-bold text-amber-900">Not authorized</h1>
        <p className="mt-1 text-sm text-amber-800">
          Your role doesn&apos;t include access to {mod.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">{mod.name}</h1>
        <span className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink/60">
          {mod.phase}
        </span>
      </div>
      <p className="max-w-3xl text-ink/70">{mod.description}</p>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="border-b border-line bg-bone px-4 py-2.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink/70">
            scaffold status
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-display text-sm font-bold text-emerald-900">✅ Data layer ready</p>
            <p className="mt-1 text-sm text-emerald-800">
              Tables, constraints and RLS policies are in the validated schema
              migration:
            </p>
            <ul className="mt-2 list-inside list-disc font-mono text-xs text-emerald-900">
              {mod.tables.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-bone p-4">
            <p className="font-display text-sm font-bold text-ink">🚧 UI in this phase</p>
            <p className="mt-1 text-sm text-ink/65">
              This page is a scaffold placeholder. The interactive UI for this
              module is delivered in {mod.phase.toLowerCase().replace('—', '·')} of
              the roadmap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
