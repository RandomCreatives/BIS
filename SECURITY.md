# Security policy

SOAMS processes student records, attendance, staff identities, educational
assessments, and privacy-sensitive IEP notes. Treat all production data as
confidential.

## Reporting a vulnerability

Do **not** open a public issue containing exploit details, personal data, keys,
or screenshots of student records. Use GitHub's private vulnerability reporting
for this repository (Security → Advisories → **Report a vulnerability**). If that
feature is unavailable, contact the repository owner privately and provide only
a minimal, redacted reproduction.

Include the affected revision, impact, prerequisites, and suggested mitigation.
Do not test against a real school deployment without written authorization.

## Supported version

Only the latest revision of `main` is supported before the first production
release. After releases begin, this file will list the supported release line
and security-fix window.

## Security boundaries

1. **Postgres RLS is authoritative.** UI visibility and Next.js redirects are
   usability controls, not authorization controls.
2. **The protected server layout verifies the Auth user and staff profile.**
   Next.js `proxy.ts` only refreshes sessions and performs optimistic redirects.
3. **Security-definer functions authorize internally.** They use a controlled
   search path, bounded inputs, least-privilege EXECUTE grants, and active-user
   checks.
4. **Deactivation is enforced in RLS.** Disabling a profile removes its effective
   role and database access even if an Auth session has not expired yet.
5. **IEP data is a separate privacy domain.** Only active assigned special-needs
   teachers and admins may access it.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for trust boundaries and
[`soams/soams-app/supabase/migrations/`](soams/soams-app/supabase/migrations/)
for the executable policy definitions.

## Production deployment checklist

### Identity and access

- [ ] Disable public sign-up; use invite-only staff provisioning.
- [ ] Require email confirmation and set the minimum password policy agreed with
      the school (12+ characters is recommended).
- [ ] Enable MFA for admins and principals when supported by the rollout plan.
- [ ] Configure Supabase Auth rate limits and CAPTCHA for externally reachable
      authentication endpoints; explicitly allow the selected CAPTCHA origins in
      the Content Security Policy when it is enabled.
- [ ] Never derive a role from `raw_user_meta_data`; users can edit it.
- [ ] Bootstrap the first admin through the trusted Supabase SQL editor, then
      perform later role changes through an authenticated admin workflow.
- [ ] Review active staff, class assignments, subject assignments, and special
      needs allocations at least once per term and immediately after departures.

### Secrets and environment

- [ ] Keep `.env.local` and platform secrets out of Git.
- [ ] The anon/publishable key may be public, but RLS must remain enabled.
- [ ] Never expose a service-role/secret key through `NEXT_PUBLIC_*`.
- [ ] Use separate Supabase projects for development, staging, and production.
- [ ] Rotate credentials after suspected exposure and review Auth/database logs.

### Database and storage

- [ ] Apply every migration in order; do not deploy only the original schema
      snapshot.
- [ ] Run role-based RLS tests against a non-production database.
- [ ] Keep both Storage buckets private and add object policies before uploads.
- [ ] Store object paths, not public URLs; issue short-lived signed URLs after an
      authorization check.
- [ ] Enable managed backups and test restoration before launch.
- [ ] Add an append-only audit trail before production data entry (tracked as a
      launch gate in the scalability plan).

### Application and platform

- [ ] Serve only over HTTPS; verify HSTS and the other headers from
      `next.config.ts` at the deployed edge.
- [ ] Restrict deployment previews and logs because they may contain school data.
- [ ] Run `npm run check` and `npm run audit:prod` for every release.
- [ ] Review Dependabot alerts; do not use `npm audit fix --force` without
      inspecting the proposed dependency graph.
- [ ] Configure error reporting to redact names, email addresses, UUID payloads,
      free-text remarks, IEP content, and access tokens.

## Dependency audit note (2026-07-31)

`npm run audit:prod` reports zero known production vulnerabilities. The lockfile
uses reviewed overrides for patched PostCSS and Sharp releases while Next.js
updates its exact transitive requirements. A full development audit still
reports the current `brace-expansion` denial-of-service advisory through ESLint's
legacy `minimatch` graph; forcing `brace-expansion` 5.x breaks that API, and the
published lint plugins do not yet support a clean graph. CI lints only trusted
repository content. Dependabot is enabled, and this exception should be removed
as soon as compatible upstream releases are available.

## Known launch gates

The system is still pre-production. General-purpose audit logging, tested
backup/restore procedures, private Storage RLS policies, retention rules, and a
complete hosted-staging RLS role matrix must be completed before live student
data is entered.
