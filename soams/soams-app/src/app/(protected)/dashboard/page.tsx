import Link from 'next/link';
import { ClipboardCheck, Table2, FileBadge2, ArrowRight, Sparkles } from 'lucide-react';
import { getCurrentContext, getCurrentYear, safeCount, unreadAnnouncementsCount } from '@/lib/data';
import { modulesForRole, ROLE_LABELS } from '@/lib/roles';

export default async function DashboardPage() {
  const { user, profile } = await getCurrentContext();
  // The (protected) layout guarantees these exist.
  if (!user || !profile) return null;

  const [students, staff, classes, unread, year] = await Promise.all([
    safeCount('students'),
    safeCount('profiles'),
    safeCount('classes'),
    unreadAnnouncementsCount(user.id),
    getCurrentYear(),
  ]);

  const modules = modulesForRole(profile.role);
  const can = (slug: string) => modules.some((m) => m.slug === slug);
  const fresh = students === 0;

  return (
    <div className="space-y-6">
      {/* editorial header */}
      <div className="border-b border-line pb-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink/50">
          {ROLE_LABELS[profile.role]} · {year ? year.name : 'academic year 2026/2027'}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Your digital binder is ready — attendance, marksheets, lesson plans
          and certificates all in one place.
        </p>
      </div>

      {/* quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="students" value={students} />
        <StatCard label="staff" value={staff} />
        <StatCard label="classes" value={classes} />
        <StatCard label="unread notices" value={unread} href="/announcements" />
      </div>

      {/* quick actions */}
      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line bg-bone px-4 py-2.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink/60">
            quick actions
          </span>
          <span className="font-mono text-[10px] text-ink/40">v0.1</span>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          {can('attendance') && (
            <QuickAction href="/attendance" icon={<ClipboardCheck className="h-4 w-4" />}>
              Mark attendance today
            </QuickAction>
          )}
          {can('evaluations') && (
            <QuickAction href="/evaluations" icon={<Table2 className="h-4 w-4" />}>
              Enter marksheets
            </QuickAction>
          )}
          {can('reports') && (
            <QuickAction href="/reports" icon={<FileBadge2 className="h-4 w-4" />}>
              Generate certificates
            </QuickAction>
          )}
        </div>
      </section>

      {/* setup helper for a fresh binder */}
      {fresh && (
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-sm font-bold text-brand-900">
              Set up your binder
            </h2>
          </div>
          <p className="mt-1 text-sm text-brand-800/80">
            No students yet. The fastest path is the CSV import — it registers a
            whole year of students in one go.
          </p>
          <Link
            href="/admin/students/import"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            Import students (CSV) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* module launcher */}
      <section>
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink/50">
          your binder sections
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.slug}
              href={m.href}
              className="group rounded-xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-ink">{m.name}</h3>
                <span className="rounded-full border border-line bg-bone px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-ink/55">
                  {m.phase}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink/65">{m.description}</p>
              <span className="mt-3 flex items-center gap-1 font-mono text-[10px] font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
                open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>
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
    <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink/50">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">
        {value === null ? '—' : value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function QuickAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 bg-white px-4 py-3 text-xs font-bold text-ink/70 transition hover:bg-bone hover:text-ink"
    >
      <span className="text-brand-500 group-hover:text-brand-600">{icon}</span>
      {children}
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink/30 transition group-hover:text-ink/60" />
    </Link>
  );
}
