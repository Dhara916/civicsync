# CivicSync

**Public works, in sync.** CivicSync gives residents a clear view of nearby public works and gives departments a shared way to publish progress, handle reports, and coordinate work before the same road is dug up again.

> Hackathon project. Use clearly labelled staging data for demonstrations; this app is not an emergency reporting service.

## The problem

Road repairs, water pipelines, drainage work, and other public projects are often planned by different departments and contractors. Residents may not know what is happening, who is responsible, or when the disruption will end. When schedules are not coordinated, the same street can be disturbed repeatedly. Useful feedback from residents can also be difficult to route and follow up.

## What CivicSync does

- **Makes projects easier to find:** Browse registered works by road, department, status, and location, and view saved locations on a map.
- **Shows progress over time:** Departments publish dated status, progress, and delay explanations that appear in the project timeline.
- **Flags possible “Dig Once” conflicts:** The database checks overlapping work dates, work types, and saved road segments or nearby mapped extents. Authorized officials can review an alert and record a coordination decision with a note and history.
- **Creates a citizen follow-up path:** Signed-in residents can submit a project report and check its status. Authorized staff can review reports and record a response.
- **Protects official actions:** Official access is requested through the app and requires administrator approval. Database Row Level Security and protected database functions enforce permissions.

Conflict alerts indicate **potential coordination needs**, not a final engineering finding. Officials must verify actual site conditions.

## User roles

| Role | Main actions |
| --- | --- |
| Public visitor | Browse public projects, timelines, and map locations |
| Citizen | Sign in, submit a project report, and track its status |
| Department official | Request access, then manage projects and updates for the approved department; review relevant reports and conflict alerts |
| Administrator | Approve or reject official access and oversee report review and coordination workflows |

## Built with

- React 19, TypeScript, Vite, and React Router
- Supabase Auth, PostgreSQL, Row Level Security, and database functions
- Leaflet and OpenStreetMap tiles for project maps
- Node.js 22.12 or newer

## Run locally

### 1. Install dependencies

Install Node.js 22.12 or newer, then open a terminal in the repository folder:

```powershell
npm install
Copy-Item .env.example .env.local
```

### 2. Configure Supabase

In `.env.local`, set the URL and **publishable** key for your Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put a Supabase `service_role` or secret key in a browser variable or commit it to Git. `.env.local` is ignored by Git; `.env.example` is the safe template to share.

### 3. Prepare the database

For a **new, empty, isolated staging project only**, follow [`docs/STAGING_SETUP.md`](docs/STAGING_SETUP.md). Person 2’s base schema and policies must be installed before the CivicSync migrations, in this order:

1. `person2-backend/supabase/schema.sql`, then `policies.sql` and (optional synthetic) `seed.sql`.
2. Review and run `supabase/preflight.sql`.
3. Apply `supabase/migrations/000_extend_person2_enums.sql`.
4. Apply `supabase/migrations/conflict_detection.sql`.

**Do not rerun the base schema, policies, or seed against a database that already contains accounts or project data.** Never run `supabase/tests/fixture.sql` against a real project. Review the staging and deployment guides before using a different Supabase project.

In Supabase Authentication URL Configuration, add the local callback URLs:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

### 4. Start the app

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Checks

Run these before submitting code changes:

```powershell
npm run check:env
npm run check:source
npm run typecheck
npm run test
npm run build
```

The SQL tests require a disposable PostgreSQL database with PostGIS and are documented in [`docs/TESTING.md`](docs/TESTING.md). Do not point the fixture tests at staging or production data.

## Deployment

The app is configured for Vercel, but **this repository does not imply that a deployment is live**. For Vercel settings, build-time environment variables, production Auth redirects, and launch checks, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Deploy only after validating the intended database and environment. The browser must use a Supabase publishable key, with database access controlled by RLS.

## Project guides

- [`docs/STAGING_SETUP.md`](docs/STAGING_SETUP.md) — isolated staging setup and migration order
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel and production launch guidance
- [`docs/TESTING.md`](docs/TESTING.md) — automated and manual checks
- [`docs/CONFLICT_RULES.md`](docs/CONFLICT_RULES.md) — how potential overlaps are detected and reviewed
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — demo walkthrough and responsible staging-data guidance
- [`docs/PERSON_2_HANDOFF.md`](docs/PERSON_2_HANDOFF.md) — backend integration details

## Team contribution structure

The root folder is the integrated CivicSync application. `person2-backend/` preserves Person 2’s original backend deliverables for reference; the integrated app uses the root `src/` services and compatibility adapter. Database migrations for the integrated workflows are in `supabase/migrations/`.
