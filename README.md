# Pride Law Case Management

An original, multi-tenant legal practice management platform built with Next.js, Supabase, PostgreSQL, Linear, GitHub Actions, and Vercel.

## Core modules

- Supabase Auth with server-side sessions
- Firm-scoped row-level security
- Intake pipeline
- Clients and matters
- Tasks and deadlines
- Calendar events
- Document metadata and private storage policies
- Time entries and invoices
- Operational reporting
- Immutable-style audit history
- Edge Function matter summaries

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create or select a Supabase project.
3. Apply `supabase/migrations/202609010001_initial_legal_ops.sql`.
4. Add the project URL and publishable key to `.env.local`.
5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Create the first user in Supabase Auth; the first profile is assigned the admin role.
For password recovery links, include `http://localhost:3000/auth/callback` (and your deployed `/auth/callback` URL) in Supabase Auth redirect URL allow-lists.

## One-time team invite seed

To invite initial team members through Supabase Admin Auth and mark them as `invited` in `public.profiles`, run:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
APP_URL=http://localhost:3000 \
node scripts/seed-users.mjs
```

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `APP_URL` (defaults to `http://localhost:3000`; invite redirect is `${APP_URL}/auth/callback`)

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

The repository is configured for Vercel and GitHub Actions. Add these GitHub repository secrets for optional CLI-driven Vercel jobs:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Add these variables in Vercel for Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only; add only when a server workflow requires it)

Vercel's native Git integration creates a preview URL for each pull request and deploys `main` to production.

## Security

This is a working MVP, not a completed compliance certification. Before placing real client information into the system, complete a formal security review, verify invite-only account creation, configure backups and retention, test disaster recovery, document incident response, and review applicable professional-responsibility and privacy requirements. Never expose the Supabase secret key to the browser.

## Project management

Linear project: [Pride Law Case Management](https://linear.app/fuegogay/project/pride-law-case-management-c089f92cca5a)

## License

Proprietary — Pride Law. All rights reserved.
