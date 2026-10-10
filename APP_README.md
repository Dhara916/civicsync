# Archived Person 1/3 contributor README

This file is preserved from the original contribution. It describes the pre-merge app and records what had not been integrated at that time. For the current merged implementation and correct setup order, follow the root [README](README.md) and [Person 2 integration handoff](docs/PERSON_2_HANDOFF.md).

# CivicSync — Person 1 + Person 3

React/TypeScript citizen and official workspace, with a PostgreSQL/PostGIS Dig-Once conflict engine. Prepared against **CivicSync_Team_Plan (1).docx**. Person 2’s production database, authentication setup and existing implementation have **not** been supplied or merged.

## What this ZIP contains

| Area | Implementation supplied |
| --- | --- |
| Citizen frontend | Responsive navigation; database-derived dashboard counts; project search, filters and pagination; Leaflet/OpenStreetMap maps; project details and update timelines; issue submission and My Reports. |
| Official frontend | Department-aware project registration/editing, point or traced-line locations, meaningful progress/delay updates, conflict review and decision history. |
| Accounts | Supabase sign-in, sign-up, confirmation callback, password recovery/reset and approval-aware route guards. No self-assigned official/admin role. |
| Dig-Once | Server triggers and protected RPCs; spatial, schedule and work-type checks; canonical unique project pairs; idempotent alerts and decisions; material-change reopening; retained history and optimistic concurrency. |
| Integration | A typed, live Supabase adapter behind shared services. It is a proposed contract to reconcile with Person 2, not an independently deployed second backend. |
| Delivery tooling | Vercel configuration, environment-key checks, CI, unit tests, disposable PostgreSQL integration/concurrency tests, browser smoke tests, merge guide and demo script. |

**There is no demo-data runtime mode.** Missing configuration shows a setup screen. Missing tables or RPCs produce errors. Counts come from database queries, and successful writes require a saved backend response. Test fixtures contain explicitly synthetic records, isolated from application code and deployment.

## Start the frontend

Use Node.js **22.12 or newer in the Node 22 series**. Open a terminal in this folder:

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`. Without a configured backend, the setup screen is the expected result. The first successful install creates `package-lock.json`; review and commit it. A lockfile was not fabricated in this ZIP.

To connect after Person 2’s implementation is merged, copy `.env.example` to `.env.local`:

```bash
# macOS / Linux
cp .env.example .env.local
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy anonymous key can instead use `VITE_SUPABASE_ANON_KEY`. Never put database passwords, secret keys or a service-role key in a `VITE_` variable. Restart Vite after changing environment values.

## Merge sequence — do not skip

1. Read [Person 2 handoff](docs/PERSON_2_HANDOFF.md). Compare their tables, status values, auth/profile flow and service signatures with `src/contracts/database.ts`. The plan did not specify every detail; extensions and enum choices in this package are proposed implementation decisions.
2. Keep Person 2’s production base schema, account provisioning and RLS as the source of truth. Reconcile the adapter and migration with that schema; do not create competing copies or overwrite files indiscriminately.
3. Run `supabase/preflight.sql` on a staging database. Back up existing data. Review the migration’s column, extension, permission and lifecycle assumptions. It deliberately refuses incompatible pre-existing data rather than silently converting or deleting it.
4. Apply `supabase/migrations/conflict_detection.sql` **after** the compatible base schema. This is the production extension; `supabase/tests/fixture.sql` is never a production setup script.
5. Set the browser environment and Supabase redirect URLs. Execute the build and tests below, then the live acceptance checklist with real authenticated staging accounts.

The migration makes existing project edits and project updates use atomic RPCs. Person 2’s corresponding services must be reconciled with these RPCs; direct browser `.update()` calls will not remain interchangeable.

## Commands

```bash
npm run test          # dependency-free domain/security/validation tests after TS compilation
npm run check:source  # syntax, local imports and limited source-boundary audit
npm run typecheck     # full dependency-aware TypeScript check
npm run build         # browser-secret guard, TypeScript check, production Vite build
npm run check:env     # requires configured browser environment; not a connectivity proof
npx playwright install chromium
npm run test:e2e      # actual browser smoke tests of the explicit unconfigured state
```

`npm run test:sql` is optional and requires `psql`, PostGIS, the `pg` npm dependency, and a fresh disposable database named `civicsync_test_*`. It intentionally refuses ordinary database names. See [Testing](docs/TESTING.md).

## Verification status for this delivery

**Executed:** 58 unit tests passed; 46 application TypeScript/TSX files passed the syntax/local-import/service-boundary audit. See [Verification](docs/VERIFICATION.md) and saved test output.

**Not executed here:** dependency installation, dependency-aware React typechecking, Vite production build, browser smoke tests, SQL migration/integration/concurrency tests, live Supabase authentication/RLS tests or Vercel deployment. This environment could not fetch npm dependencies and had no PostgreSQL/PostGIS server; Person 2’s backend and deployment credentials were not provided. Included tests and configuration are not represented as completed test results.

This is a source-code delivery for Persons 1 and 3 with a merge boundary, **not a claim that the final deployed full-stack product is already verified**.

## Project layout

```text
src/components/              Reusable UI, maps, alerts and resolution dialog
src/pages/                   Citizen, official, auth and setup routes
src/contracts/database.ts    Proposed UI/backend contract
src/types/                   Compatibility database types and conflict types
src/services/                Shared service names; no component-level database queries
src/integrations/            One live Person 2 adapter and strict response decoders
src/lib/                     One Supabase client, domain rules and input validation
supabase/migrations/         Production Person 3 migration only
supabase/tests/              Disposable synthetic backend-contract fixture and SQL tests
scripts/                     Environment, source, SQL and concurrency checks
.github/workflows/ci.yml      Checks ready to run after a repository push
```

## Guides

[Person 2 handoff](docs/PERSON_2_HANDOFF.md) · [Conflict rules](docs/CONFLICT_RULES.md) · [Testing](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Verification](docs/VERIFICATION.md) · [File ownership](docs/OWNERSHIP.md)

## Scope and limitations

Dig-Once alerts identify **potential** overlaps, not proven engineering incompatibility or permission to excavate. A 30-metre proximity rule and broad intrusive-work matrix are configurable design choices, not municipal standards. Missing or inaccurate registered works cannot be detected; point-only entries do not represent an entire road. All record writes depend on the actual backend’s permissions and availability. An empty authorized result can mean no visible records, not that no city projects exist.

Map results are paginated and explicitly labelled; the dashboard map initially shows at most 200 visible projects. Statistics use separate exact database-count requests and can briefly differ during concurrent writes; they are not a single transactional snapshot. Refresh/polling is not represented as guaranteed real-time push. There is no separate attachment, notification, chat or admin approval console in this team-plan scope. Report triage and account approval remain Person 2/backend responsibilities unless their incoming implementation adds the corresponding interfaces.

