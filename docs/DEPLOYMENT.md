# Vercel deployment after the backend merge

This package includes deployment configuration; it has **not** been deployed to a Vercel account.

## Backend first

The root app adapter is mapped to Person 2’s existing columns and enums. This repository does not apply migrations to a hosted database automatically. Validate the schema and both migrations in an isolated staging project before any production rollout; see [STAGING_SETUP.md](STAGING_SETUP.md) for the setup and migration order: `supabase/migrations/000_extend_person2_enums.sql`, then `supabase/migrations/conflict_detection.sql`. Apply and verify them separately. Do not rerun Person 2’s base schema, policies, or seed on a database that already contains accounts or records. The conflict migration intentionally stops if legacy conflict rows need a history-preserving conversion or active projects lack usable location data. Never apply `supabase/tests/fixture.sql` to a real Supabase project.

For Supabase Auth, configure the deployment’s Site URL and exact allowed redirect URLs:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
https://YOUR-DEPLOYMENT/auth/callback
https://YOUR-DEPLOYMENT/reset-password
```

Add preview-domain redirects deliberately when testing previews. Do not use unbounded production wildcard redirects. This client uses Supabase PKCE, so test confirmation/reset from the browser that initiated the flow and verify recovery behavior under the configured email provider.

## Repository and Vercel

Commit the reconciled source and the `package-lock.json` produced by a successful installation; exclude `.env*` except `.env.example`. Import that repository into Vercel. Use the Vite preset, Node 22, build command `npm run build`, output directory `dist`, and this package folder as the root if the repository is a monorepo.

Set browser environment variables in each intended Vercel environment:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
# Or the legacy VITE_SUPABASE_ANON_KEY, not a secret/service-role key.
VITE_MAP_LATITUDE       optional, initial map viewport only
VITE_MAP_LONGITUDE      optional
VITE_MAP_ZOOM           optional
```

These are build-time values. Redeploy after changing them. The application intentionally can build without backend configuration and display setup, so a successful Vercel build alone does not prove the app is connected. Run `npm run check:env` with intended production values during release preparation and then test actual database requests.

`vercel.json` includes SPA routing and basic security headers. HTTPS/WSS backend connectivity is allowed because the actual Supabase host is supplied later. For a hardened deployment, narrow `connect-src` to the real API/WebSocket origin after testing. Map styles need inline style support; raster map images are allowed only from the configured standard OSM tile origin. Do not add unsafe scripts to work around a broken build. Confirm auth callback query strings survive routing.

## Map service

Leaflet uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible attribution. Public OSM tiles are an externally provided service, not a bundled/offline basemap or guaranteed production SLA. Respect the tile usage policy: preserve attribution and browser referrer, do not bulk-prefetch/scrape tiles, and arrange an appropriate provider or self-hosting for usage beyond that policy. The app exposes tile failures rather than replacing them with a fake map. No geocoding API or geolocation permission is required.

## Launch checks

Run the complete checks in `TESTING.md`. Open `/projects`, `/my-reports`, `/auth/callback` and a real project URL directly, not just through navigation. Register a staging project, reload in another session, create/review a conflict, publish a real update and submit a real report. Verify each database row and server-side permissions. Review actual browser console/network errors and mobile layouts. Confirm no production bundle contains secret values.

Database migration rollback is not “delete the tables.” Back up first, maintain the applied SQL and recorded decisions, and use a separately reviewed forward/reversal migration that preserves history if needed. The supplied migration is transactional, but code and database deployments still require an agreed rollout order.

## Official references

- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase database functions: https://supabase.com/docs/guides/database/functions
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- OpenStreetMap tile policy: https://operations.osmfoundation.org/policies/tiles/
- Tailwind Vite integration: https://tailwindcss.com/docs/installation/using-vite
