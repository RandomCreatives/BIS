# SOAMS — School Operations & Academic Management System

Web platform replacing paper records and MS Publisher workflows for a school of
~250 students / 12 classes / 35–40 staff. Next.js 16 (App Router) + Supabase
(Postgres, Auth, RLS, Storage).

**Docs:** schema decisions → [`../SCHEMA_V2_NOTES.md`](../SCHEMA_V2_NOTES.md) ·
architecture → [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) ·
security → [`../../SECURITY.md`](../../SECURITY.md) · canonical schema history →
`supabase/migrations/`

---

## Quickstart

```bash
# 1. Install & run the scaffold (Node 22+; shows the setup notice)
npm ci
npm run dev          # http://localhost:3000

# 2. Create a Supabase project
#    https://supabase.com/dashboard → New project

# 3. Apply EVERY migration in filename order
#    Recommended: supabase link --project-ref <ref> && supabase db push
#    Dashboard alternative: run each supabase/migrations/*.sql file in order.

# 4. Connect the app
cp .env.local.example .env.local   # fill in URL + anon key, then restart dev server

# 5. Disable public sign-up, then invite the first admin with full_name metadata.
#    The trigger creates a least-privileged profile. In the trusted SQL editor,
#    verify the exact email and bootstrap it once:
#    update public.profiles set role = 'admin' where email = 'admin@school.example';
#    Never put authorization roles in user-editable user metadata.
```

## What's in this scaffold

| Area | Status |
|------|--------|
| Email/password auth (Supabase Auth, invite-only) | ✅ working |
| Session refresh via Next 16 `proxy.ts`; real auth gate in `(protected)/layout.tsx` | ✅ working |
| Role-based navigation & module visibility (6 roles) | ✅ working |
| Dashboard with live RLS-scoped counts | ✅ working |
| Announcements viewer with read receipts (FR-6.2) | ✅ working |
| **Daily Attendance** — register grid, batch save, term totals, class overview (FR-2.x) | ✅ working |
| **Administration** — students (+CSV import w/ atomic RPC), classes, staff, teaching assignments, academic calendar & term locks | ✅ working |
| Setup notice when Supabase isn't configured yet | ✅ working |
| Evaluations / Reports / Lesson plans / IEP UIs | 🚧 scaffold placeholders (schema + RLS already done) |

## Project structure

```
src/
  proxy.ts                      # session refresh + optimistic redirects (Node runtime)
  lib/
    env.ts                      # config detection → "scaffold mode" without env vars
    roles.ts                    # role labels + module registry (single source of truth)
    data.ts                     # getCurrentContext(), safe count helpers
    supabase/
      client.ts                 # browser client       server.ts  # server client (async cookies)
      session.ts                # updateSession() used by proxy.ts
  app/
    login/page.tsx              # sign-in (server action)
    actions/auth.ts             # login / logout
    (protected)/                # auth-gated section
      layout.tsx                # REAL authorization gate + AppShell
      dashboard/page.tsx        # stats + role-filtered module cards
      announcements/            # working module (list + mark-as-read RPC)
      attendance|evaluations|reports|lesson-plans|iep|admin/page.tsx
supabase/
  migrations/
    20260731000000_schema_v2.sql             # 17 tables, initial RLS, seed data
    20260801000000_import_students_rpc.sql   # atomic bounded import
    20260801010000_security_hardening.sql    # active-user and integrity policies
    20260802000000_class_colors_and_roles.sql # class colors, 12-class seed, Music, main-teacher attendance
  config.toml
```

## Security model (defense in depth)

1. **Postgres RLS** is the final enforcement layer — every table has policies;
   data access does not depend on the UI hiding things.
2. **`(protected)/layout.tsx`** verifies the user and staff profile on every
   render (server-side).
3. **`proxy.ts`** performs optimistic redirects and session refresh only —
   by design it is *not* the authorization boundary (see CVE-2025-29927).
4. Deactivated profiles lose their effective database role and all RLS access,
   even while an old Auth session exists.
5. `iep_entries` is privacy-critical: active assigned special-needs teacher +
   admin only.
6. Security-definer RPCs authorize internally, bound inputs, use a controlled
   search path, and are not executable by anonymous users.

Before live data, complete every launch gate in
[`../../SECURITY.md`](../../SECURITY.md) and
[`../../docs/SCALABILITY.md`](../../docs/SCALABILITY.md).

## Next build steps (roadmap order)

1. ~~**Phase 1 — Attendance + Admin**~~ ✅ shipped: attendance register grid, admin CRUD
   (students, classes, staff, assignments, calendar), atomic CSV import via `import_students` RPC.
2. **Phase 2 — Evaluations & Certificates**: criteria management, WT/WW/WA entry grid
   (RLS already restricts to assigned subject teachers), `v_term_certificate_data` →
   `@react-pdf/renderer` with an Ethiopic-capable font (Noto Sans Ethiopic), upload to
   `generated-certificates` bucket, publish workflow (`draft → published`).
3. **Phase 3 — Lesson plans**: submit/review pipeline incl. `lesson-plan-files` bucket uploads.
4. **Phase 4 — IEP logs** (read schema notes §4 open questions first).
5. **Phase 5 — Announcements publishing**: `publish_announcement()` RPC wrapper + audience picker.

## Useful commands

```bash
npm run dev        # development server
npm run check      # lint + typecheck + unit tests + production build
npm run audit:prod # fail on high-severity production dependency advisories
# Generate TypeScript types from the live DB (after linking):
npx supabase gen types typescript --linked > src/lib/database.types.ts
# Then pass <Database> generics into the createClient calls.
```
