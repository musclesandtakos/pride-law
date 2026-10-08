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
- Document template library with admin-managed .docx uploads and personalization fields
- Time entries and invoices
- Operational reporting
- Immutable-style audit history
- Edge Function matter summaries

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create or select a Supabase project.
3. Apply all SQL migrations in `supabase/migrations` in order.
4. Add the project URL, publishable key, and canonical app URL to `.env.local`.
5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Required local env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL` (canonical app origin; must be an `http(s)` origin without embedded credentials)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for trusted integrations and admin operations)
- `RINGCENTRAL_CLIENT_ID`
- `RINGCENTRAL_CLIENT_SECRET`
- `RINGCENTRAL_TOKEN_ENCRYPTION_KEY` (a long, random server-only secret)
- `RINGCENTRAL_SERVER_URL` (optional; defaults to `https://platform.ringcentral.com`)

`NEXT_PUBLIC_APP_URL` is normalized to its origin and required in production builds. Outside production, `http://localhost:3000` is the only fallback.

For RingCentral, configure the OAuth redirect URI as
`https://your-app.example/api/ringcentral/callback`. The app requests the signed-in
extension's voice, SMS, phone-number, subscription, and recording permissions. Inbound
sync is registered automatically after an administrator connects the account.

### Supabase auth callback allow-list

Add these exact callback URLs in Supabase Auth redirect settings:

- `http://localhost:3000/auth/callback`
- `https://<your-production-domain>/auth/callback`

Invitation and recovery links use this same callback path with flow/query parameters; the allow-list must include the canonical callback URL on every environment.

## One-time team invite seed

To invite initial team members through Supabase Admin Auth and mark them as `invited` in `public.profiles`, run:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
APP_URL=https://app.example.com \
node scripts/seed-users.mjs
```

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` (required `http(s)` origin without embedded credentials)

The seed uses `APP_URL` for invite redirects and now points invites to `/auth/callback?flow=invite`.

## Authentication and status enforcement

- Invitation callbacks and password-recovery callbacks are handled as separate flows.
- Verified invitation callbacks continue to `/onboarding`, where the active user creates a password before signing in normally.
- Recovery always continues to `/reset-password` and never activates profiles.
- Invited users become active only when Supabase records their first email confirmation event.
- Missing, invited, or disabled profiles are signed out and rejected from protected pages and APIs.
- The auth callback remains public so invitation confirmation can complete.

## Template access rules

- Unauthenticated users cannot access template APIs.
- Active staff (non-admin) can read template metadata and download signed URLs.
- Only active firm admins can upload, update, or delete templates and template storage objects.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

The repository is configured for Vercel and GitHub Actions. The `Vercel Deploy` workflow builds and deploys preview environments for non-draft pull requests and production for pushes to `main`.

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Why secrets are validated inside workflow steps: GitHub Actions does not allow `secrets.*` in job-level `if` expressions, so explicit shell validation steps fail fast with clear errors when credentials are missing.

Add these variables in Vercel for Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

`SUPABASE_SERVICE_ROLE_KEY` is trusted server-only credential material for admin operations (such as invite seeding and controlled backend tasks). Never expose it to browser code, client bundles, or committed source files.

Link the Vercel project to the repository once so the CLI can pull project settings, then add the three GitHub secrets above. Pull request deployments are skipped for forks because GitHub does not expose repository secrets to forked pull_request runs.

## Security

This is a working MVP, not a completed compliance certification. Before placing real client information into the system, complete a formal security review, verify invite-only account creation, configure backups and retention, test disaster recovery, document incident response, and review applicable professional-responsibility and privacy requirements.

## Project management

Linear project: [Pride Law Case Management](https://linear.app/fuegogay/project/pride-law-case-management-c089f92cca5a)

## License

Proprietary — Pride Law. All rights reserved.

## Weekly appointment calendar

`/events` opens the current Monday–Sunday week in `America/New_York`. Staff can navigate weeks, return to this week, search appointments, refresh newly submitted intakes, or show all hours. The default grid shows 8 a.m.–6 p.m. in half-hour slots; the agenda includes appointments outside those hours.

Choose **Schedule appointment** or a grid slot. **Client intake form** is the default source: selecting an intake supplies its name, email, phone, and practice area. Saving uses the existing `schedule_intake_consultation` RPC, which books or reschedules the upcoming initial consultation, updates the intake stage, and completes the follow-up task. **Manually entered by staff** collects attendee/contact details, appointment type, duration, location, and notes and saves an event through `/api/appointments`. Both endpoints require an active staff profile, and writes use the signed-in user's firm and existing RLS. Readonly accounts can view appointments.

This change uses the existing events/intakes tables and the `20260920053822_connect_intake_follow_up_workflow.sql` migration; it requires no new schema migration. Dates entered in either scheduling form use Eastern Time regardless of browser timezone. Nonexistent or ambiguous times during a daylight saving transition are rejected with a message to choose another time.
