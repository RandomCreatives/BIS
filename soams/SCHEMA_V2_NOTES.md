# SOAMS — Database Schema v2 Notes

**Companion to `schema_v2.sql`.** Explains what changed from `Database.md` v1, why, and how the schema is used by the application at runtime.

**Validation status:** all 117 statements executed successfully in PostgreSQL (PGlite 16), with smoke tests passing for the auth trigger, announcement publishing, the certificate data view, enrollment-year integrity, evaluation uniqueness, and RLS enabled on all 17 tables.

---

## 1. Changelog: issue → resolution

Maps to the gap list from the design review.

| # | v1 Issue | Resolution in v2 |
|---|----------|------------------|
| 1 | **IEP logging had no table** (SRD Module 5 unimplementable) | New `iep_entries` table (`target` / `progress` / `behavior` / `milestone` entry types) with the strictest RLS in the system: only the assigned special-needs teacher and admin can read or write. |
| 2 | **No academic year dimension** — data collides across years | New `academic_years` + `terms` tables. Terms carry date ranges (which drive attendance totals automatically) and a `locked_at` column. Only one year may be `is_current` (enforced by a partial unique index). |
| 3 | **No enrollment history** — promotion overwrote class context | `students.class_id` **removed** (this is a deliberate breaking change). Class membership now lives in `enrollments(student_id, class_id, academic_year_id)`, one row per student per year. |
| 4 | **No teacher↔subject↔class assignments** | New `teaching_assignments` table. It powers the Admin allocation UI **and** the RLS policies that decide who may evaluate whom. |
| 5 | **Read receipts / individual targeting impossible** | New `announcement_recipients` table, materialized at publish time via the `publish_announcement()` RPC (all-staff, by-role, or individual list). `read_at` timestamp = the receipt satisfying FR-6.2. |
| 6 | **`ON DELETE CASCADE` on `students.class_id`** — deleting a class wiped students and all history | Classes and students are now decoupled via `enrollments`, and structural foreign keys use `ON DELETE RESTRICT`. Deletion of anything with history is deliberately hard; use `is_active` / `status` flags instead. |
| 7 | **Criteria keyed by yearly class** — rebuilt from scratch every September | New `grade_levels` table; `term_criteria` is now a **reusable curriculum library** per *(subject, grade level, term number)*. Retire old criteria with `is_active = false` instead of deleting (protects historical evaluations). |
| 8 | **`principal_signed` but no principal role** | `principal` added to `user_role`. Sign-off is now `signed_by` (who) + `signed_at` (when) columns on `term_reports`, not booleans — richer audit trail. |
| 9 | **No term closure / locking** | Two mechanisms: (a) `terms.locked_at` freezes **evaluation entry** for that term (enforced in RLS `WITH CHECK`), (b) `term_reports.status` = `draft → published`, where teachers can only ever write `draft` — publishing is admin/principal-only by policy. |
| 10 | **No auth linkage** | `profiles.id` now references `auth.users(id)` (standard Supabase pattern) with an `on_auth_user_created` trigger — staff are onboarded by inviting them in Supabase Auth with `full_name` and `role` in user metadata. |

**Minor fixes:** role default removed from `profiles` (no insecure default); `lesson_plans` gets `unique(teacher_id, subject_id, class_id, term_id, week_number)` plus `reviewed_by/reviewed_at`; announcement `target_role` is now a proper enum (`announcement_audience` + `user_role`); `students.status` (`active/transferred/graduated`) replaces hard deletes; `updated_at` triggers added to 6 mutable tables; indexes added for every hot query path.

**New conveniences:**
- `v_term_certificate_data` — one query returning everything the PDF engine needs for the report summary: student, class, grade, year, term, work habits, remarks, and per-term attendance totals computed from date ranges.
- `publish_announcement(title, content, audience, target_role?, recipient_ids?)` — one RPC call creates the announcement and its recipients atomically; rejects non-admin/principal callers.
- `mark_announcement_read(announcement_id)` — one-tap acknowledge for the stamp/bell icon.
- `my_role()` helper — used across all RLS policies.

---

## 2. Core design decisions (the "why")

### 2.1 Classes are recreated every September
`classes` carries `academic_year_id`, so "Year 3 Magenta 2026/2027" and "Year 3 Magenta 2027/2028" are separate rows. This is the linchpin that makes history **automatically correct**: attendance, enrollments, and teaching assignments all point at the class *as it existed that year*. Rollover cost is trivial at this scale (12 `INSERT`s), and the September checklist is below.

### 2.2 Enrollment year integrity is airtight
`enrollments` has **both** `UNIQUE(student_id, academic_year_id)` (one class per student per year) **and** a composite FK `(class_id, academic_year_id) → classes(id, academic_year_id)` (the class must actually belong to that year). Test 5 in the validation suite confirms a wrong-year enrollment is rejected at the database level — no application bug can corrupt this.

### 2.3 Evaluation permission is derived, not assumed
A subject teacher may insert an evaluation **only if all of these hold** (single RLS `WITH CHECK`):
1. the term is unlocked;
2. a `teaching_assignments` row matches the criterion's subject, the teacher, **and** a class the student is enrolled in that year.

So "which teachers may touch this row" always reflects the Admin's current allocations — there's no permission cache to go stale.

### 2.4 Attendance totals are computed, not stored
`daily_attendance` has no `term_id`; term totals come from the term's date range via the certificate view. Storing both would invite inconsistency (e.g., a mid-year calendar change). One exception: `daily_attendance.class_id` *is* stored (rather than joined through enrollments) because the attendance grid's hot path is always class + date, and it acts as a stable snapshot of where the mark was taken.

### 2.5 Two distinct "freeze" points
- `terms.locked_at` — **data-entry freeze** (Admin closes the term; subject teachers can no longer add/change evaluations). Operational.
- `term_reports.published_at` / `status = 'published'` — **certificate issuance** (Admin/Principal generates and releases PDFs). Legal/administrative.

Keep them separate: you often want to lock entry *before* certificates are reviewed, signed, and published.

---

## 3. How the app uses this (Supabase wiring)

### 3.1 Onboarding a staff member
1. Admin invites the user in Supabase Auth (dashboard or `admin.inviteUserByEmail`) with user metadata: `{ "full_name": "...", "role": "main_teacher" }`.
2. The `on_auth_user_created` trigger creates the `profiles` row automatically.
3. Admin then assigns classes/subjects via `classes`, `teaching_assignments`, `enrollments`.

### 3.2 Storage buckets to create (not in SQL — do in Dashboard/CLI)
| Bucket | Access | Contents |
|--------|--------|----------|
| `lesson-plan-files` | private; owner + admin/principal | Teacher uploads for `lesson_plans.file_url` |
| `generated-certificates` | private; admin/principal + signing main teacher | PDFs referenced by `term_reports.pdf_url` |

Suggested path conventions: `lesson-plan-files/{teacher_id}/{term_id}/week_{n}.pdf` and `generated-certificates/{year}/{term}/{student_id}.pdf`.

### 3.3 Certificate generation flow (per term)
1. Main teacher completes work habits + remarks (`term_reports`, stays `draft`).
2. Subject teachers finalize evaluations; Admin sets `terms.locked_at`.
3. For each class: app reads `v_term_certificate_data` + per-subject evaluations (`student_evaluations` ⋈ `term_criteria` grouped by subject, ordered by `sort_order`), renders PDF (recommended: `@react-pdf/renderer` server-side; embed an Ethiopic-capable font, e.g. **Noto Sans Ethiopic**, for Amharic content).
4. App uploads PDF, sets `pdf_url`, `generated_at`, signature columns, `status = 'published'`, `published_at`.
5. Keep the MS Publisher parallel run for Term 1 as a safety net (per project plan).

---

## 4. RLS policy model (starter set)

All 17 tables have RLS enabled. The shipped policies implement:

| Data | Read | Write |
|------|------|-------|
| Reference data (years, terms, subjects, grades, criteria, classes, assignments) | all authenticated staff | admin / principal |
| `profiles` | own row; admin/principal all | self (name/phone only — the `role = my_role()` check blocks privilege escalation); admin all |
| `students` | staff with a working relationship (main/assistant teacher of current class, assigned subject teacher, assigned SN teacher, admin/principal) | admin |
| `enrollments`, `daily_attendance` | class main/assistant teacher, related subject teachers, admin | class main/assistant teacher, admin |
| `student_evaluations` | evaluator, related subject teachers, class main teacher, admin/principal | assigned subject teacher while term unlocked (see §2.3), admin |
| `term_reports` | class main/assistant teacher, admin/principal | main teacher **draft only**; admin/principal publish |
| `lesson_plans` | author, admin/principal | author while `draft`/`needs_revision` (may flip to `submitted`); admin/principal review |
| `iep_entries` | author, assigned SN teacher, admin | author being the assigned SN teacher, admin |
| `announcements` + recipients | sender-side admin/principal; recipient sees own | publish via `publish_announcement()`; recipients can only set their own `read_at` |

**To confirm with the school before launch:**
- Should the **principal** (beyond admin) read IEP entries? Currently no — deliberately private.
- Should **main teachers** get read access to IEP entries for students in their class? Currently no.
- Should **parents/guardians** ever receive accounts? Out of scope for v2 — would need a `guardians` + `student_guardians` table and a dedicated read-only policy set (post-launch phase).
- Should criteria management be delegated to **subject leads** (SRD FR-3.1 says "Admin or Subject Leads")? Currently admin/principal only.

**Implementation notes:**
- Test every policy with `set request.jwt.claims` / different users in the Supabase SQL editor before launch. The starter set covers the FR permission matrix but deserves a dedicated test pass.
- `my_role()` is `stable security definer` — one row-lookup per query; fine at 40-user scale. If profiling ever shows it hot, swap for a custom JWT claim hook.

---

## 5. September rollover checklist (per year)

1. `INSERT` new `academic_years` row (`is_current = true` — the partial unique index forces you to unset the old one first) and its 3 `terms` with real calendar dates.
2. `INSERT` 12 new `classes` rows (copy `class_name` + `grade_level_id`, new year, assign teachers).
3. `INSERT` `enrollments` for each student (promote grade levels; mark leavers `status = 'transferred'/'graduated'`).
4. `INSERT` new-year `teaching_assignments`.
5. Review `term_criteria` for curriculum changes (deactivate superseded ones, add new).

~15 minutes of admin work per year, scriptable later as a `rollover_year()` function if desired.

---

## 6. Known limitations / next iterations

- **Audit log** — no general change-history table yet. Recommended once real data flows (simple `audit_log(table_name, row_id, actor, action, changed_at, diff jsonb)` written by triggers).
- **Guardian portal** — out of scope (see open questions).
- **Attendance backfill for absences on non-school days** — the app (not the DB) should prevent marking on weekends/holidays; term date ranges already bound the data.
- **Multi-section classes** — current model assumes one class per grade-section per year, matching the SRD's 12-class scope.

---

## 7. Applying the schema

```bash
# Option A — Supabase dashboard: paste schema_v2.sql into the SQL Editor, run once.

# Option B — Supabase CLI (recommended once the app repo exists):
supabase init
supabase db start
psql "$DATABASE_URL" -f schema_v2.sql        # or split into supabase/migrations/
```

Remember afterwards:
- [ ] Create the 2 Storage buckets (§3.2)
- [ ] Adjust seed term dates to the school's real calendar
- [ ] Invite the first admin and verify the profile trigger fired
- [ ] Run the RLS test pass (§4)
