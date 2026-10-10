# Create and prepare an isolated Supabase staging project

Use staging to validate the merged app and migrations. These steps do not touch the existing Supabase project.

## 1. Create the staging project

In the Supabase dashboard, select **New project** and create a project named `civicsync-staging` in your organization. Choose a region close to your test users and set a unique database password in the dashboard. Keep that password private; the React app does not need it. Wait until the project reports that it is ready.

## 2. Initialize the empty staging database

Open **SQL Editor → New query** in the staging project. Open each file from `person2-backend/supabase/` in the integrated folder and run them one at a time in this order:

1. `schema.sql`
2. `policies.sql`
3. `seed.sql`

These are initialization scripts for a brand-new staging database only. The seed data is synthetic. Never rerun these scripts against the existing project that already contains your approved admin and users.

## 3. Add a staging-only admin account

In the staging dashboard, enable email/password under **Authentication → Sign In / Providers**. Register a staging-only email account in the app or create it through **Authentication → Users**. If email confirmation is enabled, confirm the staging account first. Then, in the staging SQL Editor, use the one-time admin promotion SQL from `person2-backend/BACKEND_SETUP.md`, substituting the exact staging account email. Do not promote a production user or share a password here.

## 4. Run the integrated migrations in order

In the staging SQL Editor, run `supabase/preflight.sql` and inspect its output. Then run and commit each migration separately, waiting for success before the next:

1. `supabase/migrations/000_extend_person2_enums.sql`
2. `supabase/migrations/conflict_detection.sql`

If either migration reports an error, stop and preserve the complete error text. Do not retry by changing or dropping staging tables. Resolve the issue first. Never run `supabase/tests/fixture.sql` in the Supabase dashboard; that fixture is only for a fresh disposable local PostgreSQL test database.

## 5. Connect only the local app to staging

Copy `.env.example` to `.env.local` in the root of `CivicSync_Final`. From **Project Settings → API** in the staging project, copy the Project URL and publishable key into these local variables:

```dotenv
VITE_SUPABASE_URL=https://YOUR-STAGING-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_STAGING_PUBLISHABLE_KEY
```

Never use a secret/service-role key in `.env.local`, a `VITE_` variable, Vercel, or the browser. Do not send keys or database passwords in chat. After setting the file, run `npm run check:env`, then `npm run dev` and verify the app header/setup screen shows that it is connected to staging.

## 6. Configure staging Auth redirects and verify flows

In staging **Authentication → URL Configuration**, set the Site URL to the local app origin shown by Vite (usually `http://localhost:5173`) and add:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Follow `TESTING.md`'s live acceptance table using only staging test accounts and synthetic works. Verify signup/confirmation, password recovery, project creation, project updates, reports, and conflict review. A successful SQL query or local build alone does not validate these flows.

## Stop before production

This staging project is only a safety and integration test. No migrations have been applied to the existing project, and this runbook does not authorize a production migration or public deployment. Review the staging evidence and production rollout plan before either action.
