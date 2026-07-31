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
    <div className="flex min-h-screen items-center justify-center bg-bone px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ink font-display text-xl font-bold text-bone">
            S
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            British International School
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            SOAMS · setup wizard
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line bg-bone px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink/55">
            connect your Supabase project
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-sm text-ink/60">
              The application shell is built and waiting for its database. Four
              steps to go live:
            </p>
            <ol className="mt-5 space-y-3">
              {STEPS.map((s) => (
                <li key={s.title} className="rounded-lg border border-line bg-bone p-4">
                  <p className="font-display text-sm font-bold text-ink">{s.title}</p>
                  <p className="mt-1 text-sm text-ink/60">{s.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 font-mono text-[11px] text-ink/45">
              See README.md for the full quickstart, and ../SCHEMA_V2_NOTES.md for
              the schema design decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
