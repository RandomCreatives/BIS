import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentContext, getCurrentYear, safeCount } from '@/lib/data';
import { PageHeader } from '@/components/forms';

// Admin hub — section cards with live counts.
export default async function AdminPage() {
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/dashboard');

  const [year, students, staff, classes] = await Promise.all([
    getCurrentYear(),
    safeCount('students'),
    safeCount('profiles'),
    safeCount('classes'),
  ]);

  const sections = [
    {
      href: '/admin/students',
      title: 'Students',
      desc: 'Register students, set special-needs flags, and manage class enrollments.',
      stat: students === null ? '—' : `${students} registered`,
    },
    {
      href: '/admin/students/import',
      title: 'CSV Import',
      desc: 'Bulk-import a whole year of students from Excel — paste CSV, preview, confirm.',
      stat: 'fastest rollout path',
    },
    {
      href: '/admin/classes',
      title: 'Classes',
      desc: `Classes for the current year, with main & assistant teacher assignments.`,
      stat: classes === null ? '—' : `${classes} this year`,
    },
    {
      href: '/admin/staff',
      title: 'Staff',
      desc: 'Roles, contact details and active status. New staff are invited via Supabase Auth.',
      stat: staff === null ? '—' : `${staff} accounts`,
    },
    {
      href: '/admin/assignments',
      title: 'Teaching Assignments',
      desc: 'Which subject teacher teaches which subject in which class — powers evaluation access.',
      stat: 'drives RLS',
    },
    {
      href: '/admin/calendar',
      title: 'Academic Calendar',
      desc: 'Academic years, term dates, and term locking (freezes evaluation entry).',
      stat: year ? `${year.name} current` : '⚠ no current year',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle={
          year
            ? `Current academic year: ${year.name} (${year.start_date} → ${year.end_date})`
            : 'No current academic year — create one under Academic Calendar.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{s.title}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {s.stat}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
