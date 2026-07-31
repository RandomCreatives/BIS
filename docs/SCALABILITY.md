# Scalability and reliability plan

The initial school size is small; correctness, privacy, and recoverability matter
more than distributed-system complexity. Scale in measured stages rather than
adding infrastructure pre-emptively.

## Baseline assumptions

- ~250 students, 12 classes, 35–40 staff;
- one school and one deployment;
- bursts around morning attendance and end-of-term reporting;
- documents are larger than relational data and belong in private Storage;
- Addis Ababa school time is the business clock; database timestamps remain UTC.

## Phase 0 — production readiness (required before live data)

1. Expand the migration/RLS smoke suite into a complete role-by-role matrix,
   including wrong-year access, locked terms, every mutation, and IEP isolation;
   run the same matrix against hosted staging in addition to PGlite.
2. Add append-only audit events for role changes, assignments, student changes,
   attendance edits, evaluation edits, term locks, report publication, and IEP
   access-sensitive mutations. Define who may read and export the log.
3. Implement and test private Storage bucket/object policies. Use randomized or
   UUID paths and short-lived signed downloads.
4. Replace non-transactional admin sequences with RPCs:
   academic-year + term creation, current-year switch, and student + enrollment
   upsert. Cleanup-after-error is not equivalent to a transaction.
5. Establish daily managed backups, monthly restore drills, retention, incident
   response, and data-export procedures.
6. Add redacted error monitoring, request correlation IDs, health checks, and
   alerts for elevated auth failures, database errors, and backup failures.

## Phase 1 — one larger school (up to ~2,000 students / 200 staff)

- Keep the same topology; Postgres and Next.js are sufficient.
- Generate TypeScript database types and eliminate stringly typed table/RPC use.
- Paginate admin lists and reports; do not fetch whole-school rows into a page.
- Replace exact dashboard counts with scoped summary RPCs or cached aggregates if
  query measurements justify it.
- Batch attendance/evaluation writes in constrained transactional RPCs.
- Generate certificates asynchronously with a job table, idempotency key,
  attempts, timestamps, and a worker; do not hold a browser request for a class
  batch.
- Add indexes only from `EXPLAIN (ANALYZE, BUFFERS)` evidence. Monitor slow query
  logs, connection count, index hit rate, table growth, and Storage growth.
- Add connection pooling for any non-Supabase server connection.

## Phase 2 — multiple schools or ~10,000+ students

Do not represent tenancy with conventions alone. Introduce a `schools` tenant
key and include it in every tenant-owned primary access path, uniqueness rule,
foreign-key strategy, index, Storage path, audit event, and RLS policy. Migrate
and test cross-tenant isolation before onboarding a second school.

At this stage consider:

- a queue-backed worker for PDF generation, imports, notifications, and exports;
- precomputed reporting tables/materialized views refreshed by jobs;
- read replicas only for measured reporting pressure;
- per-tenant quotas and rate limits;
- archival partitions for high-volume audit/attendance data after measured need;
- regional data residency, retention, and contractual requirements.

## Hot paths and index strategy

Existing indexes target class/date attendance, enrollment class/student,
teaching assignment teacher/class, student/term evaluation, lesson plan class or
teacher, IEP student/date, unread recipients, classes/year, and reports/term.

Likely next candidates must be measurement-driven:

- active enrollment partial/access patterns involving `left_on`;
- evaluation grids filtering assignment + term + criteria;
- report publication queue (`status`, `term_id`);
- announcement history ordered by recipient and created time;
- audit events ordered by entity and time.

Every index increases write and maintenance cost. Capture the query and plan in
the PR that introduces one.

## Availability and consistency targets

Set explicit targets with the school before launch. Suggested starting points:

- RPO: 24 hours maximum, improved when managed point-in-time recovery is enabled;
- RTO: 4 business hours after a verified incident;
- attendance writes: transactional and immediately readable;
- report publishing and imports: idempotent, retryable, and auditable;
- planned maintenance communicated outside attendance/report deadlines.

## Capacity signals

Review monthly and before each term close:

- p50/p95 page and database latency;
- failed RLS/mutation rates (without logging sensitive payloads);
- table/index/Storage size and growth;
- database connections and saturation;
- certificate job queue age and failure count;
- backup success and last proven restore;
- active user count and announcement fan-out.

Scale only after a signal breaches an agreed threshold or load testing shows the
next term's projected workload will do so.
