# Testing and acceptance

Read `VERIFICATION.md` first: implemented test suites are not equivalent to executed results.

## 1. Local application checks

```bash
npm install
npm run test
npm run check:source
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests use no network/backend dependency. They cover dates, input/GeoJSON validation, role/department rules, work-type/status matrices, safe browser keys, search normalization and formatting. SQL, not the mirrored TypeScript functions, is authoritative for persistent conflict detection.

The source audit is deliberately limited: TypeScript syntax, local import resolution, component/service boundaries and the presence of selected migration safeguards. It is **not** full type checking, SQL parsing or a security certification.

Browser smoke tests open the real application with blank backend configuration. They check truthful setup, direct/deep links, a not-found page, small-screen overflow and mobile navigation. They do not mock Supabase or validate the live data workflows.

## 2. Disposable PostgreSQL/PostGIS tests

Prerequisites: Docker or another PostgreSQL 16+ instance with PostGIS, the PostgreSQL `psql` client, and installed npm dependencies. Create a **fresh, disposable** database; never point this runner at Supabase production.

Example local setup:

```bash
docker run --name civicsync-test-db -e POSTGRES_PASSWORD=local_test_only -e POSTGRES_DB=civicsync_test_local -p 5433:5432 -d postgis/postgis:16-3.4
# Wait until the database is healthy/ready.
export CIVICSYNC_TEST_DATABASE_URL='postgresql://postgres:local_test_only@127.0.0.1:5433/civicsync_test_local'
npm run test:sql
```

PowerShell environment equivalent:

```powershell
$env:CIVICSYNC_TEST_DATABASE_URL = 'postgresql://postgres:local_test_only@127.0.0.1:5433/civicsync_test_local'
npm run test:sql
```

The fixture refuses databases not named `civicsync_test_*`. It sets up synthetic contract tables, roles and users. Its small `auth.uid()` substitute tests SQL authorization logic only; it is **not** actual Supabase Auth. The fixture may remove the disposable image’s preinstalled PostGIS extension and recreate it in `extensions`. It must never be copied into a production migration.

The runner applies the production migration twice to test repeatability, then executes SQL expectations and true concurrent-writer/reviewer tests. These cover persisted unique pairs, inclusive dates, geometry/segments, history, decisions, unauthorized roles, citizen report isolation in the fixture, optimistic versions, atomic schedule changes and write serialization. A fresh database is required for another complete run; the fixture deliberately does not wipe existing tables to conceal a reuse mistake.

After testing, remove only the disposable container:

```bash
docker rm -f civicsync-test-db
```

## 3. Required live acceptance after Person 2 merge

Use a staging Supabase database and clearly labelled test projects, not public production works. Create two approved officials in different departments, a third unrelated official, a pending official, two citizens and an approved admin through Person 2’s real provisioning flow. Do not fake a JWT in the browser.

| Flow | Expected evidence |
| --- | --- |
| Anonymous browse | Actual visible projects, saved counts and details; no private reports/profile emails exposed. |
| Sign-up and confirmation | Real account, correct citizen profile and redirect, no role self-assignment. |
| Password recovery | Real reset email, correct local/deployed callback, saved new password. |
| Official register | INSERT returns a saved UUID; reload and another session see the same record. Unapproved/wrong-department inserts fail. |
| Conflicting project | Register an overlapping intrusive project near the first or on the same trusted segment; one saved pair appears without depending on a browser conflict check. |
| Retry | Replay a check/decision/update with its exact request ID; no duplicate alert/event/update. Reuse with different content fails. |
| Citizen report | A real citizen submits a report, reloads My Reports, and sees the saved row. A different citizen cannot read it through direct API calls. |
| Official decision | An involved approved official records a public note. Reload in another session shows the exact note, reviewer and retained history. Unrelated/pending/citizen users cannot call the RPC successfully. |
| Schedule update | Publish a revised date and meaningful note; the project, timeline and conflict state change atomically. Delayed status requires a reason. |
| Concurrent decision | Two reviewers act on the same version; the later/stale decision cannot overwrite the first. |
| History/reopening | Resolve, materially change a work item, and verify reopening on the same pair with the original event retained. |
| No-longer-conflicting | Move/cancel/finish or reschedule one work item; stale current alerts clear without deleting history. |
| Report status | Person 2’s authorized triage updates a report; the citizen sees the real new status after reload. No pretend triage endpoint. |
| Error handling | Deny a policy, remove a staging RPC, interrupt the network, and verify visible errors/no simulated success. |
| Deployment | Open nested URLs directly on Vercel, validate redirects/key scope, and repeat a saved-write/reload flow. |

Also review direct REST/RPC access: hiding a UI button is not authorization. Test role/department self-escalation, foreign-report access, profile mutation, unauthorized project inserts and direct conflict/history writes. Check both table-level and column-level grants, extra policies and any Person 2 functions that could bypass intended permissions.

## 4. Release condition

Do not present this as an end-to-end verified deployment until dependency installation, typecheck/build, PostgreSQL tests, browser tests and the live acceptance flows pass against the merged backend. Save actual command output and deployment commit identifiers. Record failures and unresolved assumptions; do not turn “not tested” into “passed.”
