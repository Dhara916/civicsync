# CivicSync backend setup and integration contract

This package is Person 2's shared Supabase source of truth. It covers authentication profiles, departments, public projects, citizen reports, verified project timelines, Dig-Once conflict records, row-level security, and project audit history. The demo seed data is synthetic. Replace the demo contacts, location, and schedules with reviewed local data before presenting them as real public works.

## Configure Supabase

1. Create a Supabase project and enable email/password authentication. Configure email confirmation as required by the deployment. Phone OTP is optional and requires enabling phone auth and connecting an SMS provider.
2. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/policies.sql`, then `supabase/seed.sql`, in that order. The seed contains synthetic departments and projects. After creating a dedicated test citizen account, optionally replace its address in `supabase/demo_report.sql` and run that file to add one sample report.
3. Create an initial administrator account through Supabase Auth. From the SQL editor (as the project database owner), promote that exact account once:

   ```sql
   update public.profiles p
   set role = 'admin', approval_status = 'approved', department_id = null
   from auth.users u
   where p.id = u.id and lower(u.email) = lower('ADMIN_EMAIL_HERE');
   ```

   The user must already have signed up so the auth trigger has created the profile. An applicant submits `requestOfficialAccess(departmentId)`, which makes the profile pending and grants no official privileges. Administrators review the pending profiles and approve them with `approveOfficial(userId, departmentId)`.
4. Copy `.env.example` to `.env.local`; set the project URL and publishable key. These are browser-safe values. Never use a secret/service-role key in React, a `VITE_*` variable, or a checked-in file.
5. Install the project's existing dependencies with its package manager. This backend contract expects `@supabase/supabase-js` and Vite's `import.meta.env` typing. Merge the dependency and compiler settings into the shared frontend project rather than replacing its package manifest.

## Roles and protections

- New email or phone signups get a `citizen` profile from a database trigger. User metadata never grants a role. Citizens can read public project/departments/timelines/conflict alerts, submit reports, and read their own reports.
- An admin approves an official and assigns one department. Approved officials can create and update projects, append timeline updates, and review reports for their department. Admins can manage all departments and projects.
- Report review, official approval, and conflict resolution run through checked PostgreSQL functions. Project writes are recorded in `project_audit_log`; public-facing history is `project_updates`.
- Photo storage is private and limited to JPEG/PNG/WebP up to 5 MB. The permitted object path is `reports/<authenticated-user-id>/<unique-name>`.
- RLS is the access control boundary. UI role checks are only for display. Never ship a service-role key to the browser.
- This prototype does not request or store Aadhaar numbers. Add identity verification only through an authorized, compliant provider if a later requirement needs it.

## Frontend service contract

```ts
getProjects(filters?)             // map/list/search; returns public projects with department name
getProject(id)                    // one public project
createProject(data)               // approved official for assigned department or admin
updateProject(id, changes)        // same RLS permission as create
getDashboardStats()               // aggregate project/report/conflict counts
submitReport({projectId,category,description,photoPath?})
getMyReports()                    // RLS returns only current user's reports
getReportsForDepartment(id)       // RLS enforces assigned department/admin
reviewReport(id,status,response?) // checked PostgreSQL function
getProjectUpdates(projectId)
addProjectUpdate(input)           // append verified history; delay requires reason
signUpWithEmail / requestPhoneOtp / verifyPhoneOtp / signInWithEmail / signOut
getCurrentProfile / onAuthStateChange / requestOfficialAccess / approveOfficial
uploadReportPhoto(file)           // returns bucket-relative path for submitReport
getReportPhotoUrl(path)           // returns a short-lived signed URL subject to bucket RLS
```

The dashboard RPC returns `planned_projects`, `ongoing_projects` (includes delayed), `overdue_projects` (based on revised end date where present), `open_reports`, and `open_conflicts`. It exposes aggregate counts only; report details remain protected.

## Person 3 conflict integration

`project_conflicts` is the shared table. Store each pair in ascending UUID order (`project_a_id < project_b_id`); its unique constraint makes retries idempotent. `reason` is required. Open conflicts are publicly readable. Inserts require an approved official assigned to at least one of the projects or an admin. Conflict detection should run server-side/through a protected database workflow and compare road/segment, inclusive overlapping dates (`a.start_date <= b.end_date AND b.start_date <= a.end_date`), and compatible work types. Person 3's `resolveConflict` service should call:

```ts
supabase.rpc('resolve_project_conflict', {
  p_conflict_id: conflictId,
  p_status: decision, // coordinating | resolved | dismissed
  p_resolution_note: note,
})
```

Only an official responsible for either department or an admin can resolve/dismiss; a non-empty note is required. The table and RPC are the agreed interface, so no second conflict table or direct browser update is needed.

## Shared data shape

- `projects` includes UUID IDs, department, status, dates, single map point, and optional start/end coordinates for a road segment.
- `project_updates` is append-only history. Inserting an update also synchronizes the project's current status/progress/revised end date. A delayed update requires a reason.
- `citizen_reports` keeps the resident's report and official response/status separate from verified project updates.
- `project_audit_log` captures project insert/update/delete snapshots for admin accountability.

Keep this schema as the single agreed contract. If the team changes enum values or fields, update `src/types/database.ts`, these SQL files, and the frontend/conflict services together.
