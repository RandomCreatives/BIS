# Operations runbook

## Environments

Maintain isolated development, staging, and production Supabase projects. Never
copy live student or IEP data into development. Use synthetic records for tests,
demos, screenshots, and bug reports.

## Release procedure

1. Review the diff, migration order, environment changes, and security impact.
2. Run from `soams/soams-app`:

   ```bash
   npm ci
   npm run check
   npm run audit:prod
   ```

3. Back up production and confirm the latest restore evidence.
4. Apply pending migrations to staging; execute RLS role tests and smoke tests.
5. Apply migrations to production as a controlled step.
6. Deploy the matching application revision.
7. Verify login, dashboard, one RLS-scoped read, and a synthetic/non-sensitive
   mutation appropriate to the release.
8. Monitor errors and database health. Record the revision and migration set.

Database migrations and application code are one release unit. Do not deploy
code that requires a pending migration.

## First administrator

Public sign-up must remain disabled. Invite/create the first staff identity, then
use the trusted Supabase SQL editor to assign that one profile the `admin` role.
Verify the email exactly before updating. Do not place an admin role in
user-editable metadata. After bootstrap, use the application admin workflow and
retain a second active admin to reduce lockout risk.

## Staff departure

1. Set `profiles.is_active = false` immediately; RLS removes effective access.
2. Revoke/terminate Supabase Auth sessions and disable the Auth identity.
3. Reassign classes, subjects, and special-needs students.
4. Review sensitive recent activity and rotate credentials if compromise is
   suspected.
5. Preserve historical references; do not delete a profile used by records.

## Backup and restore

- Enable managed database backups and point-in-time recovery if available.
- Record Storage backup/versioning separately; database backup does not imply
  private object recovery.
- Perform a monthly restore into an isolated project, run migrations if needed,
  compare row counts/checksums, and execute smoke tests.
- Record backup timestamp, restore duration, operator, revision, findings, and
  deletion of the temporary restored environment.

A backup is not considered valid until restoration has been demonstrated.

## Incident response

1. Contain: deactivate affected accounts, revoke sessions/keys, and restrict the
   deployment if active exposure continues.
2. Preserve: record UTC times, revisions, logs, and actions without copying
   sensitive payloads into tickets or chat.
3. Assess: affected identities, tables, Storage objects, and time range.
4. Eradicate: patch the root cause, rotate secrets, apply migrations, and review
   equivalent paths.
5. Recover: restore or correct data, verify RLS, redeploy, and monitor.
6. Follow up: document impact, notifications required by school policy/law,
   corrective actions, and regression tests.

## Term operations

Before term close, verify assignments and unresolved data-entry errors. Lock the
term only after teachers confirm evaluation completion. Report publication is a
separate state from term lock. Test certificate generation with Ethiopic text
and retain a controlled parallel process until the school accepts output.

## Logging and privacy

Logs must not contain passwords, access/refresh tokens, Auth headers, full CSV
imports, report remarks, IEP text, or signed Storage URLs. Prefer event names,
request IDs, actor IDs, entity IDs, status, duration, and redacted error codes.
Restrict log access and define retention before production.
