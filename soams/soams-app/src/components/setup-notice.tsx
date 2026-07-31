// Shown whenever Supabase isn't configured yet, so the scaffold runs cleanly
// out of the box and tells the operator exactly what to do.

const STEPS = [
  {
    title: '1. Create a Supabase project',
    body: 'Free tier is plenty for ~250 students. Pick a region close to your users.',
  },
  {
    title: '2. Run the schema migration',
    body: 'supabase/migrations/20260731000000_schema_v2.sql — validated, 17 tables, RLS included.',
  },
  {
    title: '3. Set environment variables',
    body: 'Copy .env.local.example to .env.local and fill in your project URL and anon key.',
  },
  {
    title: '4. Invite the first admin',
    body: 'Supabase Dashboard → Authentication → Invite user, with metadata { "full_name": "...", "role": "admin" }.',
  },
];

export function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
          SOAMS — scaffold ready
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Connect your Supabase project
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The application shell is built and waiting for its database. Four
          steps to go live:
        </p>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-slate-500">
          See README.md for the full quickstart, and ../SCHEMA_V2_NOTES.md for
          the schema design decisions.
        </p>
      </div>
    </div>
  );
}
