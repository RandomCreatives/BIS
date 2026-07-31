import Link from 'next/link';
import { getCurrentContext, safeCount, unreadAnnouncementsCount } from '@/lib/data';
import { modulesForRole, ROLE_LABELS } from '@/lib/roles';

export default async function DashboardPage() {
  const { user, profile } = await getCurrentContext();
  // The (protected) layout guarantees these exist.
  if (!user || !profile) return null;

  const [students, staff, classes, unread] = await Promise.all([
    safeCount('students'),
    safeCount('profiles'),
    safeCount('classes'),
    unreadAnnouncementsCount(user.id),
  ]);

  const modules = modulesForRole(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {profile.full_name.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-semibold">{ROLE_LABELS[profile.role]}</span>
        </p>
      </div>

      {/* Live stats — powered by RLS, so each role sees only what it may see.
          "—" simply means the migration hasn't been run yet. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={students} />
        <StatCard label="Staff" value={staff} />
        <StatCard label="Classes" value={classes} />
        <StatCard label="Unread notices" value={unread} href="/announcements" />
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Your modules
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.slug}
              href={m.href}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">
                  {m.name}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {m.phase}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{m.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | null;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value === null ? '—' : value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
