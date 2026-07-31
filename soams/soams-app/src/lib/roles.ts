// Single source of truth for roles and module visibility.
// Mirrors the user_role enum in supabase/migrations — keep in sync.

export type Role =
  | 'admin'
  | 'principal'
  | 'main_teacher'
  | 'assistant_teacher'
  | 'subject_teacher'
  | 'special_needs_teacher';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'School Admin',
  principal: 'Principal',
  main_teacher: 'Main Teacher',
  assistant_teacher: 'Assistant Teacher',
  subject_teacher: 'Subject Teacher',
  special_needs_teacher: 'Special Needs Teacher',
};

export const ALL_ROLES: Role[] = [
  'admin',
  'principal',
  'main_teacher',
  'assistant_teacher',
  'subject_teacher',
  'special_needs_teacher',
];

export interface ModuleDef {
  slug: string;
  name: string;
  href: string;
  description: string;
  phase: string; // delivery phase from the project roadmap
  tables: string[]; // schema objects powering this module
  roles: Role[]; // who sees this module in the nav
}

export const MODULES: ModuleDef[] = [
  {
    slug: 'dashboard',
    name: 'Home',
    href: '/dashboard',
    description:
      'Overview: today\u2019s register status, quick actions, and module shortcuts. Every staff member lands here.',
    phase: 'Live',
    tables: [],
    roles: ALL_ROLES,
  },
  {
    slug: 'attendance',
    name: 'Daily Attendance',
    href: '/attendance',
    description:
      'Mark daily attendance per class on a mobile-friendly grid. Statuses: Present, Absent, Late, Excused. Owned by each class\u2019s Main Teacher; assistants support in-class only. Term totals feed the certificates automatically.',
    phase: 'Live',
    tables: ['daily_attendance', 'enrollments', 'classes'],
    roles: ['admin', 'principal', 'main_teacher'],
  },
  {
    slug: 'evaluations',
    name: 'Standards-Based Evaluations',
    href: '/evaluations',
    description:
      'Enter WT / WW / WA attainment per curriculum criterion, per subject, per term. Locked automatically when Admin closes a term.',
    phase: 'Phase 2',
    tables: ['term_criteria', 'student_evaluations', 'teaching_assignments'],
    roles: ['admin', 'principal', 'main_teacher', 'subject_teacher'],
  },
  {
    slug: 'reports',
    name: 'Term Reports & Certificates',
    href: '/reports',
    description:
      'Work-habits grades (E/G/S/N), narrative remarks, signatures, and the generated PDF certificates that replace the MS Publisher workflow.',
    phase: 'Phase 2 — flagship',
    tables: ['term_reports', 'v_term_certificate_data'],
    roles: ['admin', 'principal', 'main_teacher'],
  },
  {
    slug: 'lesson-plans',
    name: 'Weekly Lesson Plans',
    href: '/lesson-plans',
    description:
      'Submit weekly plans per subject/class (term weeks 1–12). Flow: Draft → Submitted → Approved / Needs Revision, with admin feedback.',
    phase: 'Phase 3',
    tables: ['lesson_plans'],
    roles: ALL_ROLES,
  },
  {
    slug: 'iep',
    name: 'Special Needs (IEP)',
    href: '/iep',
    description:
      'Private IEP targets, progress milestones, and behavioral logs for assigned students. Restricted to the assigned teacher and Admin.',
    phase: 'Phase 4',
    tables: ['iep_entries', 'students'],
    roles: ['admin', 'special_needs_teacher'],
  },
  {
    slug: 'announcements',
    name: 'Announcements',
    href: '/announcements',
    description:
      'Notice board with read receipts. Admin/Principal publish to all staff, a role, or individuals; everyone acknowledges with one tap.',
    phase: 'Phase 5',
    tables: ['announcements', 'announcement_recipients'],
    roles: ALL_ROLES,
  },
  {
    slug: 'admin',
    name: 'Administration',
    href: '/admin',
    description:
      'Manage staff accounts, classes, enrollments, subjects, teaching assignments, term criteria, and the academic calendar. Year-rollover tools.',
    phase: 'Live',
    tables: [
      'profiles',
      'classes',
      'enrollments',
      'academic_years',
      'terms',
      'teaching_assignments',
      'grade_levels',
      'subjects',
      'term_criteria',
    ],
    roles: ['admin'],
  },
];

export function modulesForRole(role: Role): ModuleDef[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function getModule(slug: string): ModuleDef | undefined {
  return MODULES.find((m) => m.slug === slug);
}
