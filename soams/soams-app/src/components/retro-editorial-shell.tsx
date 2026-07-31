'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  ClipboardCheck,
  Table2,
  FileText,
  BookOpen,
  HeartHandshake,
  Bell,
  Settings,
  Search,
  StickyNote,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import type { Profile } from '@/lib/data';
import { modulesForRole, ROLE_LABELS, ALL_ROLES } from '@/lib/roles';
import type { Role } from '@/lib/roles';
import { logout } from '@/app/actions/auth';
import { StudentSearchModal } from './student-search-modal';
import { TeacherScratchpad } from './teacher-scratchpad';
import { FloatingDocks } from './floating-docks';

const TAB_ORDER = [
  'dashboard',
  'attendance',
  'evaluations',
  'reports',
  'lesson-plans',
  'iep',
  'announcements',
  'admin',
];

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Home',
  attendance: 'Daily Attendance',
  evaluations: 'Standards Marksheet',
  reports: 'Term Reports',
  'lesson-plans': 'Lesson Plan Drafts',
  iep: 'Special Needs IEP Logs',
  announcements: 'Admin Notice Board',
  admin: 'Administration',
};

const TAB_EMOJI: Record<string, string> = {
  dashboard: '🏠',
  attendance: '📋',
  evaluations: '📊',
  reports: '📄',
  'lesson-plans': '📝',
  iep: '⭐',
  announcements: '📢',
  admin: '⚙️',
};

const TAB_ICONS: Record<string, LucideIcon> = {
  dashboard: Home,
  attendance: ClipboardCheck,
  evaluations: Table2,
  reports: FileText,
  'lesson-plans': BookOpen,
  iep: HeartHandshake,
  announcements: Bell,
  admin: Settings,
};

export function RetroEditorialShell({
  profile,
  termLabel,
  currentYearId,
  children,
}: {
  profile: Profile;
  termLabel: string | null;
  currentYearId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [previewRole, setPreviewRole] = useState<Role>(profile.role);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // ⌘K / Ctrl-K opens the universal search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const modules = modulesForRole(previewRole);
  const tabs = [...modules].sort(
    (a, b) => (TAB_ORDER.indexOf(a.slug) - TAB_ORDER.indexOf(b.slug)),
  );
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/') || (href === '/dashboard' && pathname === '/');

  return (
    <div className="min-h-screen bg-bone text-ink">
      {/* ── sticky top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line bg-bone/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink font-display text-sm font-bold text-bone">
              S
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-sm font-bold tracking-tight text-ink">
                British International School
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                SOAMS · school operations
              </p>
            </div>
          </div>

          {termLabel && (
            <span className="hidden shrink-0 rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] font-semibold text-ink/70 md:inline-block">
              {termLabel}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* role switcher (preview) */}
            <div className="relative hidden sm:block">
              <select
                value={previewRole}
                onChange={(e) => setPreviewRole(e.target.value as Role)}
                title="Preview this role's view"
                className="appearance-none rounded-lg border border-line bg-white py-1.5 pl-3 pr-7 text-xs font-semibold text-ink/70 outline-none transition hover:border-ink/30 focus:border-brand-400"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/50" />
            </div>

            {/* universal search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink/60 outline-none transition hover:border-ink/30 hover:text-ink focus:border-brand-400"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search students…</span>
              <kbd className="hidden rounded border border-line bg-bone px-1 font-mono text-[10px] text-ink/50 sm:inline">
                ⌘K
              </kbd>
            </button>

            {/* scratchpad */}
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              aria-label="Teacher scratchpad"
              title="Teacher scratchpad"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                notesOpen
                  ? 'border-ink bg-ink text-bone'
                  : 'border-line bg-white text-ink/60 hover:border-ink/30 hover:text-ink'
              }`}
            >
              <StickyNote className="h-4 w-4" />
            </button>

            {/* identity + sign out */}
            <div className="hidden text-right leading-tight md:block">
              <p className="text-xs font-semibold text-ink">{profile.full_name}</p>
              <p className="font-mono text-[10px] text-ink/50">{ROLE_LABELS[profile.role]}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/60 transition hover:border-red-300 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* ── horizontal module tabs ───────────────────────────────────── */}
        <nav className="border-t border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 py-1.5">
            {tabs.map((m) => {
              const Icon = TAB_ICONS[m.slug] ?? Home;
              return (
                <Link
                  key={m.slug}
                  href={m.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive(m.href)
                      ? 'bg-ink text-bone shadow-sm'
                      : 'text-ink/65 hover:bg-white hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{TAB_EMOJI[m.slug] ? `${TAB_EMOJI[m.slug]} ` : ''}</span>
                  <span>{TAB_LABELS[m.slug] ?? m.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ── content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-20">{children}</main>

      {/* ── floating edge docks (left modules, right shortcuts) ───────── */}
      <FloatingDocks previewRole={previewRole} />

      {/* ── overlays ───────────────────────────────────────────────────── */}
      {searchOpen && (
        <StudentSearchModal currentYearId={currentYearId} onClose={() => setSearchOpen(false)} />
      )}
      {notesOpen && <TeacherScratchpad onClose={() => setNotesOpen(false)} />}
    </div>
  );
}
