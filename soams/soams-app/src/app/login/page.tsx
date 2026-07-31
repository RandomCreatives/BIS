import { login } from '@/app/actions/auth';
import { SetupNotice } from '@/components/setup-notice';
import { SubmitButton } from '@/components/submit-button';
import { isSupabaseConfigured } from '@/lib/env';

// Next 16: searchParams is a Promise and must be awaited.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bone px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ink font-display text-xl font-bold text-bone">
            S
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            British International School
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            SOAMS · staff sign in
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line bg-bone px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink/55">
            staff portal
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form action={login} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink/80">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-line bg-bone px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  placeholder="you@school.edu"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink/80">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-line bg-bone px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  placeholder="••••••••"
                />
              </div>
              <SubmitButton className="w-full">Sign in</SubmitButton>
            </form>

            <p className="mt-6 text-center font-mono text-[11px] text-ink/45">
              Accounts are created by invitation from your school administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
