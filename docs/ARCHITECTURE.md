# SOAMS architecture

## Context

SOAMS is a staff-only school operations application sized initially for roughly
250 students, 12 classes, and 35–40 staff. It is a Next.js App Router application
backed by Supabase Auth, Postgres, Row-Level Security (RLS), and private Storage.

```text
Staff browser
    │ HTTPS + Supabase session cookies
    ▼
Next.js application
  ├─ Server Components: RLS-scoped reads
  ├─ Server Actions: validation + mutations
  ├─ Protected layout: verified user/profile gate
  └─ Proxy: session refresh and optimistic redirects only
    │ anon/publishable key + user JWT
    ▼
Supabase
  ├─ Auth: identity and sessions
  ├─ Postgres: system of record + RLS + constrained RPCs
  └─ Storage: private lesson-plan and certificate objects
```

## Trust boundaries

- Browser values, form fields, Server Action arguments, query strings, file
  names, CSV contents, and Auth user metadata are untrusted.
- Next.js holds no service-role key. It calls Supabase as the signed-in user, so
  Postgres can enforce the same policy regardless of UI or route.
- `raw_user_meta_data` is presentation data only. Authorization comes from the
  `profiles` row; only trusted app metadata may seed a role.
- Server Actions validate for clear errors and resource bounds. RLS and database
  constraints repeat security-critical checks because actions can change.
- Security-definer RPCs are narrow transaction/privilege boundaries, not general
  data-access shortcuts.

## Request and authorization flow

1. `proxy.ts` refreshes the Supabase session and may redirect obvious anonymous
   requests. It is not relied upon as an authorization boundary.
2. `(protected)/layout.tsx` calls `auth.getUser()` (server-verified) and loads the
   staff profile.
3. Module pages perform role-aware UX filtering.
4. Every query reaches a table with RLS enabled. Policies validate active status,
   role, and row relationships.
5. Mutations set actor columns to `auth.uid()` and the database checks assignment
   and calendar integrity.

## Data design

- Academic years own terms and year-specific class rows.
- Enrollments connect a student to one class per year and preserve year context.
- Teaching assignments are the source of subject-teacher permissions.
- Attendance stores a class snapshot for the class/date hot path.
- Reusable criteria are keyed by subject, grade, and term number; evaluations
  additionally bind to a concrete year term.
- Announcement recipients are materialized at publish time for stable targeting
  and inexpensive unread counts.
- IEP entries are deliberately isolated by stricter policies.

## Deployment topology

Use three isolated environments: development, staging, and production. Each has
its own Supabase project, Auth users, Storage buckets, secrets, and database.
Deploy the Next.js app to a managed Node-capable platform, run migrations as a
separate controlled release step, and never run schema migration on application
startup.

## Architecture decisions

- **RLS over API-only authorization:** protects data even if a route or UI check
  is omitted.
- **Server Actions over a separate API service:** appropriate for current scale,
  while keeping mutation validation close to the page.
- **Materialized announcement recipients:** at tens or hundreds of staff, stable
  read receipts are worth the small write amplification.
- **Computed attendance totals:** avoids a second total that can drift from daily
  records.
- **Additive migrations:** shared environments remain reproducible and auditable.

## Current gaps

Before production, expand the automated RLS smoke tests into a complete role
matrix and run it against hosted staging; also add append-only audit events,
private Storage policies, backup-restore evidence, structured redacted telemetry,
and transactional RPCs for remaining multi-step admin operations.
