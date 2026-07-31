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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900">Not authorized</h1>
        <p className="mt-1 text-sm text-amber-800">
          Your role doesn&apos;t include access to {mod.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{mod.name}</h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {mod.phase}
        </span>
      </div>
      <p className="max-w-3xl text-slate-600">{mod.description}</p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Scaffold status
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">✅ Data layer ready</p>
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
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">🚧 UI in this phase</p>
            <p className="mt-1 text-sm text-slate-600">
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
