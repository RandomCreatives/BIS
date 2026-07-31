'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  ClipboardCheck,
  Table2,
  BookOpen,
  HeartHandshake,
  Bell,
  Settings,
  BookMarked,
  Users,
  CalendarDays,
  Printer,
  Trash2,
} from 'lucide-react';
import { modulesForRole } from '@/lib/roles';
import type { Role } from '@/lib/roles';

// Web-OS style left toolbar — the module icons from the original desktop design.
const DOCK_LABELS: Record<string, string> = {
  dashboard: 'Home',
  attendance: 'Attendance',
  evaluations: 'Evaluations',
  'lesson-plans': 'Lesson Plans',
  iep: 'Special Needs',
  announcements: 'Announcements',
  admin: 'Admin',
};

const DOCK_ICONS: Record<string, LucideIcon> = {
  dashboard: Home,
  attendance: ClipboardCheck,
  evaluations: Table2,
  'lesson-plans': BookOpen,
  iep: HeartHandshake,
  announcements: Bell,
  admin: Settings,
};

const DOCK_ORDER = [
  'dashboard',
  'attendance',
  'evaluations',
  'lesson-plans',
  'iep',
  'announcements',
  'admin',
];

// Desktop shortcuts shelf from the original design, mapped onto real routes.
interface Shortcut {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
}

const SHORTCUTS: Shortcut[] = [
  { label: 'School Handbook', href: '/lesson-plans', icon: BookMarked, roles: ['admin', 'principal', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'special_needs_teacher'] },
  { label: 'Class Roster', href: '/admin/students', icon: Users, roles: ['admin'] },
  { label: 'Term Calendar', href: '/admin/calendar', icon: CalendarDays, roles: ['admin'] },
  { label: 'Print Certificates', href: '/reports', icon: Printer, roles: ['admin', 'principal', 'main_teacher'] },
  { label: 'Staff Trash', href: '/admin/staff', icon: Trash2, roles: ['admin'] },
];

export function FloatingDocks({ previewRole }: { previewRole: Role }) {
  const pathname = usePathname();
  const modules = modulesForRole(previewRole)
    .filter((m) => DOCK_ICONS[m.slug])
    .sort((a, b) => DOCK_ORDER.indexOf(a.slug) - DOCK_ORDER.indexOf(b.slug));
  const shortcuts = SHORTCUTS.filter((s) => s.roles.includes(previewRole));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/') || (href === '/dashboard' && pathname === '/');

  return (
    <>
      {/* ── left web-OS module dock ─────────────────────────────────── */}
      <nav
        aria-label="Module shortcuts"
        className="fixed left-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-2 lg:flex"
      >
        {modules.map((m) => {
          const Icon = DOCK_ICONS[m.slug];
          const active = isActive(m.href);
          return (
            <Link
              key={m.slug}
              href={m.href}
              aria-label={DOCK_LABELS[m.slug] ?? m.name}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition ${
                active
                  ? 'border-ink bg-ink text-bone'
                  : 'border-line bg-white text-ink/60 hover:border-ink/30 hover:text-ink'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-lg border border-line bg-white px-2 py-1 font-mono text-[10px] font-semibold text-ink shadow-md group-hover:block">
                {DOCK_LABELS[m.slug] ?? m.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── right desktop shortcuts shelf ───────────────────────────── */}
      <nav
        aria-label="Desktop shortcuts"
        className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-2 lg:flex"
      >
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink/60 shadow-sm transition hover:border-ink/30 hover:text-ink"
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-lg border border-line bg-white px-2 py-1 font-mono text-[10px] font-semibold text-ink shadow-md group-hover:block">
                {s.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
