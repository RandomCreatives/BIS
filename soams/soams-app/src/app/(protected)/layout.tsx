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

  if (!profile) {
    // Authenticated in Supabase Auth but no staff profile — e.g. invited user
    // whose metadata was missing a role, or a deleted profile.
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-lg font-bold text-amber-900">Account not set up</h1>
          <p className="mt-2 text-sm text-amber-800">
            Your login exists but no staff profile was found. Ask your school
            administrator to check your account&apos;s role assignment.
          </p>
        </div>
      </div>
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
