import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { modulesForRole, ROLE_LABELS } from '@/lib/roles';
import type { Profile } from '@/lib/data';

// Server-rendered application shell: header with identity + sign-out, and
// role-filtered module navigation. Mobile-friendly: sidebar collapses to a
// horizontal scroll strip under the header (attendance marking on phones is
// a core requirement).
export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const modules = modulesForRole(profile.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-brand-800 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold tracking-tight">SOAMS</span>
            <span className="hidden text-xs text-brand-200 sm:inline">
              School Operations &amp; Academic Management
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{profile.full_name}</p>
              <p className="text-xs text-brand-200">{ROLE_LABELS[profile.role]}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-100 transition hover:bg-brand-600"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="border-t border-brand-600">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
            <NavLink href="/dashboard" label="Dashboard" />
            {modules.map((m) => (
              <NavLink key={m.slug} href={m.href} label={m.name} />
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-brand-100 transition hover:bg-brand-600 hover:text-white"
    >
      {label}
    </Link>
  );
}
