# BIS / SOAMS

This repository contains **SOAMS**, a School Operations & Academic Management
System for staff attendance, standards-based evaluation, reports, lesson plans,
IEP notes, and school announcements.

- Application and quickstart: [`soams/soams-app/README.md`](soams/soams-app/README.md)
- Requirements: [`uploads/SRD.md`](uploads/SRD.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Security policy and deployment checklist: [`SECURITY.md`](SECURITY.md)
- Operations runbook: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Scalability plan: [`docs/SCALABILITY.md`](docs/SCALABILITY.md)
- Contribution and collaboration workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Local verification

```bash
cd soams/soams-app
cp .env.local.example .env.local  # then provide project values
npm ci
npm run check
npm run audit:prod
```

The app intentionally renders a setup notice when Supabase is not configured,
so lint, tests, and the production build can run without production credentials.
