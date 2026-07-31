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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">SOAMS</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Staff sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          School Operations &amp; Academic Management System
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={login} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="you@school.edu"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>
          <SubmitButton className="w-full">Sign in</SubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by invitation from your school administrator.
        </p>
      </div>
    </div>
  );
}
