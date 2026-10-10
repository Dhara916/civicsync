# Person 2 integration handoff — merged contract

Person 2's Supabase schema, policies, seed, services, and generated types are preserved under `person2-backend/`. The root application does not use a second Supabase client: `src/lib/supabase.ts` initializes the only browser client, and `src/integrations/person2Adapter.ts` is the mapping boundary.

## Existing Person 2 schema kept as source of truth

The adapter reads `profiles.full_name`, `departments.contact_email/contact_phone`, and `projects.location_description`. Person 1/3 project status `in_progress` maps to Person 2 enum value `ongoing`; old work labels (`water_pipeline`, `sewer_drainage`, `road_repair`) stay readable, while the enum-extension migration adds the more specific work/report labels used by the UI. Existing report states map as `open → submitted`, `under_review → acknowledged`, `resolved → resolved`, and `dismissed → rejected`. New reports are inserted as `open`, which matches Person 2's RLS policy.

Project update publication includes `progress_percent`, which Person 2's timeline table requires. The SQL RPC updates the project and inserts the timeline row in one transaction. Person 2's profile trigger expects signup metadata `full_name`; the app sends that exact key.

## Migration order and safeguards

1. Back up the target database and run the read-only `supabase/preflight.sql`.
2. On a staging copy, apply and commit `supabase/migrations/000_extend_person2_enums.sql` first. PostgreSQL enum labels must be committed before the next migration uses them.
3. Apply `supabase/migrations/conflict_detection.sql` after reviewing it against the preflight output.
4. Run `npm run test:sql` against a fresh disposable test database and execute the staging acceptance checks in `docs/TESTING.md`.
5. Only after successful staging tests, schedule the same reviewed SQL migrations for the intended database. Never rerun the base schema/policies/seed on a database that already contains accounts and records.

The conflict migration converts `project_conflicts.status` from Person 2's enum to text to support Person 3's `cleared` lifecycle while preserving old labels such as `coordinating`. It revokes the older conflict-resolution RPC so conflict decisions go through the versioned, history-retaining RPC. If legacy conflict rows already exist without Person 3's fields, the migration stops for explicit review rather than deleting or fabricating their history.

The migration preserves Person 2's project status/work type enums and casts RPC writes back to those types. It maps legacy road-segment endpoint coordinates into work geometry during the controlled backfill. It retains project and profile/account data. Review all existing records for valid coordinates or trusted road-segment endpoints before applying.

## Browser configuration

Use only `VITE_SUPABASE_URL` and the Supabase publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`, or legacy anon key) in frontend configuration. Keep secret/service-role keys and database passwords out of the browser and repository. Configure Supabase email confirmation and password-recovery redirect URLs for localhost and the final deployment origin.
