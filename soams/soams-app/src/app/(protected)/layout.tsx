import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SetupNotice } from '@/components/setup-notice';
import { getCurrentContext } from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/env';

// THE authorization gate for every page under (protected).
// The proxy only does optimistic redirects — this layout is the real check,
// and Postgres RLS is the final enforcement layer below it.

// Every page in this section reads auth cookies — never prerender statically.
export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { user, profile } = await getCurrentContext();
  if (!user) redirect('/login');

  if (!profile || !profile.is_active) {
    // RLS intentionally hides deactivated profiles, so use one message for a
    // missing, incomplete, or disabled staff record without disclosing state.
    return (
      <div className="flex min-h-screen items-center justify-center bg-bone p-6">
        <div className="max-w-md overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line bg-bone px-4 py-2 font-mono text-[11px] font-semibold text-ink/55">
            SOAMS OS — account notice
          </div>
          <div className="p-8">
            <h1 className="font-display text-lg font-bold text-ink">Account unavailable</h1>
            <p className="mt-2 text-sm text-ink/70">
              Your staff profile is not active or has not been fully configured.
              Ask your school administrator to check your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
