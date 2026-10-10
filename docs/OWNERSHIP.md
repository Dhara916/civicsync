# Ownership and safe merge map

| Owner | Files / responsibility |
| --- | --- |
| Person 1 | `src/components/` except conflict-specific components; `src/pages/` except ConflictReview; App/main/styles; UX/loading/error handling; account UI and route guards. |
| Person 3 | conflict components, ConflictReview, conflict service/types, domain engine rules, production conflict migration, tests, integration/deployment documentation and CI. |
| Person 2 — reconcile, do not blindly overwrite | `src/lib/supabase.ts`, `src/services/projectService.ts`, `reportService.ts`, `updateService.ts`, `authService.ts`, `src/types/database.ts`, production base schema/policies and account provisioning. |
| Shared proposed contract | `src/contracts/database.ts`, `src/integrations/person2Adapter.ts`, strict decoders, enums, geometry/date semantics and atomic RPC parameters. |
| Test-only substitute for a backend contract | `supabase/tests/fixture.sql`; never a replacement for Person 2’s production schema/Auth. |

There is intentionally no production `supabase/schema.sql`, `policies.sql` or `seed.sql` in this ZIP. Person 2 owns those. Runtime records are not prepopulated. Person 2 may provide clearly labelled development seed records, but the app must still read their actual saved rows and never represent synthetic municipal work as genuine public data.

Use a merge branch. Commit each teammate’s untouched source before reconciliation. Adapt the contract once, run tests, review SQL permissions, and only then integrate into main. Do not copy an incoming `node_modules`, `.env`, `dist` or secret-bearing configuration into the shared repository.

No existing repository was pushed, branch merged, database changed or Vercel deployment created as part of this ZIP delivery.
