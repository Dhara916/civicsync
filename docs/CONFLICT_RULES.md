# Dig-Once engine: rules and boundaries

## Triggered on the server

A successful project INSERT/UPDATE runs detection in the same database transaction through statement/row triggers. Browser rechecks are supplementary, authorized operations; disabling JavaScript cannot bypass trigger-based detection. Failure aborts the database mutation rather than displaying an unpersisted alert.

A pair is a potential overlap when **all** of these hold:

1. Both projects are active: planned, in progress or delayed. Completed/cancelled work is excluded.
2. Their scheduled dates overlap inclusively: `max(start dates) <= min(end dates)`. The same calendar day counts. Dates are date-only, not ambiguous browser time-zone timestamps.
3. Both work types are intrusive under the current matrix: water, sewer, drainage, electricity, telecom, road resurfacing or excavation. Inspection is treated as nonintrusive. Same-department works are not automatically exempt.
4. They share a nonempty normalized road-segment ID **or** their PostGIS geographies lie within 30 metres. Geometry can be a point or a traced line; crossing or adjacent lines can qualify even if their first points are far apart.

The 30-metre radius and the work-type matrix are explicit hackathon product choices. They were not specified numerically in the team plan, are not a legal or excavation standard, and need calibration to actual survey quality, work widths and engineering requirements. Change the SQL and mirrored TypeScript rules/tests together.

Using the same road name alone does not establish spatial overlap. Names repeat and roads are long. A shared segment ID is only as trustworthy as the shared identifier registry. A point represents its immediate vicinity, not the full road. Prefer a traced work line for extended work and record a meaningful segment ID when available.

## One pair, retained history

Project IDs are ordered canonically and a unique index enforces one row per pair. Retries do not create a reversed or duplicate alert. The conflict stores a generated reason, overlapping dates, location evidence and distance when available.

- `open`: a current potential overlap needs review.
- `resolved`: an authorized official recorded a coordination decision for the current material situation. This does not itself modify either project’s dates or constitute engineering approval.
- `dismissed`: an authorized official recorded why no coordination is needed for this situation.
- `cleared`: the pair no longer qualifies because its location, schedule, work type or activity state changed.

`is_current` distinguishes a geometrically/schedularly qualifying pair from one cleared by the detector. Resolved/dismissed pairs may remain physically overlapping. The dashboard’s open count means **unreviewed current alerts**, not all overlapping works.

A fingerprint covers project IDs, departments, dates, work types, normalized segments and stored geographies. Cosmetic title changes or a transition between active phases do not automatically reopen a decision. A material change or return of a previously cleared overlap reopens the existing row, increments its version and adds an event. Existing decision events are retained even when the current row’s review fields are reset.

`conflict_events` records detection, reopening, clearing and human decisions. Browser roles cannot insert/update/delete this history directly. Read access follows visibility of both projects. History retention can prevent deleting referenced projects; use a cancellation workflow rather than deleting an audited project.

## Authorization and concurrency

Only an approved official of either involved department, or an approved admin, can resolve/dismiss an alert. Manual rechecks and project changes require the owning department or admin. The saved profile is checked server-side with `auth.uid()`.

Review/update forms send a stable request UUID and expected row version. Exact retries of a saved decision or published update return that saved record. Reusing a request ID with different content is rejected. A stale review or project edit fails rather than overwriting newer changes. After such an error, refresh, review the new evidence and submit a new decision. A metadata-edit RPC is version protected but not a replay-success API; after a network timeout, reload to determine whether it committed.

The implementation takes a **global transaction advisory lock before each project write statement**, and uses the same lock in protected write/review RPCs. This deliberately serializes writes for a small hackathon system and avoids two concurrent inserts missing each other or producing an obsolete review. READ COMMITTED is required; higher isolation is rejected rather than assumed safe. Concurrency tests use real independent PostgreSQL connections and are supplied, but were not executed in the authoring environment.

This is not a high-throughput municipal write architecture. Larger deployments need measured performance, queue/locking design and geographically partitioned concurrency guarantees, not merely removal of the lock.

## Honest operational boundaries

The detector knows only registered and visible-to-server records, not unreported contractors, buried assets or actual excavation depth. Poor geometry, stale schedules and overbroad segment IDs cause missed alerts or false positives. It does not optimize construction sequencing, prove utility compatibility, replace site surveys, grant permits, send guaranteed push notifications or automatically reschedule work. A saved resolution is a recorded human decision, not proof that field coordination has occurred.

For every release, test identical dates, boundary proximity, crossing lines, invalid geometry, same-road/distant works, duplicate retries, authorization, stale versions, cancellation/completion, material reopening and real concurrent writes.

## Technical references

- PostGIS geography distance: https://postgis.net/docs/ST_DWithin.html
- PostgreSQL trigger semantics: https://www.postgresql.org/docs/current/sql-createtrigger.html
- Supabase database functions and security: https://supabase.com/docs/guides/database/functions
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

These explain platform behavior. The project-specific matrix, thresholds, lifecycle and contracts above are implementation decisions.
