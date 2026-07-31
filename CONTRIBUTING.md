# Contributing and collaboration

## Workstream ownership

To reduce collisions when multiple coding agents or people work concurrently:

- **Feature work:** product modules and user-facing workflows.
- **Maintenance work:** security, database integrity, tests, CI, documentation,
  observability, dependency health, and scalability review.
- Announce schema and shared-library changes before starting them; those areas
  affect every workstream.
- Prefer additive migrations. Never edit a migration already applied to a shared
  environment; add a later migration instead.

## Sync discipline

1. Fetch before starting and before handing off work.
2. Keep commits small and describe the risk or requirement addressed.
3. Rebase or merge the latest `main` into the working branch, then rerun checks.
4. Resolve semantic conflicts carefully—especially RLS policies, server actions,
   `package.json`, and shared types. A text-clean merge is not proof of safety.
5. In a PR, list migrations, environment changes, security implications, and
   manual deployment steps.

Do not force-push shared branches or push secrets, generated builds, production
exports, student data, or local Supabase state.

## Setup and checks

```bash
cd soams/soams-app
npm ci
npm run check
npm run audit:prod
```

Node.js 22 or newer is required. The test/build path works in scaffold mode
without Supabase credentials. Features that query real policies must also be
verified against an isolated Supabase project.

## Database review checklist

For every table or RPC change, check:

- RLS is enabled and both `USING` (existing row) and `WITH CHECK` (new row) are
  correct for INSERT and UPDATE semantics.
- Actor/audit columns equal `auth.uid()` where appropriate.
- Foreign keys alone are not enough: validate class/year/term/assignment scope.
- Deactivated users cannot access direct `auth.uid()` relationship policies.
- `security definer` functions use `set search_path = ''`, qualify objects,
  validate and bound input, authorize internally, and revoke PUBLIC execution.
- Multi-step invariants are transactional (prefer one RPC over cleanup logic).
- Sensitive Storage objects remain private and are authorized by object path.

## Pull request evidence

Include:

- `npm run check` result;
- `npm run audit:prod` result;
- migration apply/rollback notes and RLS role tests for database changes;
- screenshots for UI changes (with synthetic data only);
- documentation updates for behavior, environment, or operational changes.
