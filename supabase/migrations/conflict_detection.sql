-- CivicSync / Person 3: server-side Dig-Once + atomic integration functions.
-- Apply AFTER Person 2's base tables, profile provisioning and RLS policies.
-- Run supabase/migrations/000_extend_person2_enums.sql first and commit it.
-- Read docs/PERSON_2_HANDOFF.md and supabase/preflight.sql before deployment.
-- No base tables, accounts, example projects or citizen reports are seeded here.
-- This migration intentionally routes project edits and update publication through
-- protected RPCs: direct authenticated UPDATE/DELETE on projects and direct writes
-- on project_updates are revoked. Person 2 must use the documented service contract.
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(7842051, 100);

DO $preflight$
DECLARE t text; missing text; ext_schema text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','departments','projects','project_updates'] LOOP
    IF pg_catalog.to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Person 2 base table public.% is missing. Apply and reconcile the base schema first.', t;
    END IF;
  END LOOP;
  SELECT string_agg(c.table_name || '.' || c.column_name, ', ') INTO missing
  FROM (VALUES
    ('profiles','id'),('profiles','full_name'),('profiles','role'),('profiles','department_id'),('profiles','approval_status'),
    ('departments','id'),('departments','name'),
    ('projects','id'),('projects','title'),('projects','road_name'),('projects','location_description'),('projects','work_type'),('projects','department_id'),('projects','start_date'),('projects','end_date'),('projects','status'),('projects','progress_percent'),
    ('project_updates','id'),('project_updates','project_id'),('project_updates','status'),('project_updates','progress_percent'),('project_updates','progress_note'),('project_updates','delay_reason'),('project_updates','revised_end_date'),('project_updates','updated_by')
  ) c(table_name,column_name)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema='public' AND x.table_name=c.table_name AND x.column_name=c.column_name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing contract columns: %. Reconcile with Person 2.', missing; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='id' AND udt_name='uuid') THEN
    RAISE EXCEPTION 'projects.id must be UUID; do not coerce or replace existing IDs.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='status' AND udt_name='project_status')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='work_type' AND udt_name='work_type')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_updates' AND column_name='status' AND udt_name='project_status') THEN
    RAISE EXCEPTION 'Expected Person 2 project_status/work_type enums. Reconcile the schema before applying.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name IN ('start_date','end_date') AND data_type <> 'date') THEN
    RAISE EXCEPTION 'Project schedule fields must be DATE, not timestamp or free text.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('work_type','water'),('work_type','sewer'),('work_type','drainage'),('work_type','road_resurfacing'),('work_type','excavation'),('work_type','inspection'),
      ('report_category','safety_hazard'),('report_category','road_damage'),('report_category','water_leak'),('report_category','access_blocked'),('report_category','noise')
    ) required(type_name,label)
    WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
      WHERE t.typnamespace='public'::regnamespace AND t.typname=required.type_name AND e.enumlabel=required.label)
  ) THEN RAISE EXCEPTION 'Apply and commit 000_extend_person2_enums.sql before this migration.'; END IF;
  FOREACH t IN ARRAY ARRAY['profiles','projects','project_updates'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.'||t)) THEN
      RAISE EXCEPTION 'Enable and configure Person 2 RLS on public.% before applying this migration.', t;
    END IF;
  END LOOP;
  SELECT n.nspname INTO ext_schema FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='postgis';
  IF ext_schema IS NOT NULL AND ext_schema <> 'extensions' THEN
    RAISE EXCEPTION 'PostGIS already uses schema %, not extensions. Reconcile the qualified PostGIS names in this migration; do not move an existing extension blindly.', ext_schema;
  END IF;
  IF pg_catalog.to_regclass('public.project_conflicts') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_conflicts' AND column_name='fingerprint') THEN
    EXECUTE 'SELECT CASE WHEN EXISTS (SELECT 1 FROM public.project_conflicts) THEN ''existing'' END' INTO missing;
    IF missing IS NOT NULL THEN RAISE EXCEPTION 'Existing conflicts use another lifecycle. Write a history-preserving conversion before applying this migration.'; END IF;
  END IF;
END $preflight$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS civicsync_private;
REVOKE ALL ON SCHEMA civicsync_private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS road_segment_id text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS work_geometry jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS work_area extensions.geography(Geometry,4326);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.project_updates ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Person 2 stores conflicts in its own enum. The Person 3 lifecycle adds the
-- terminal `cleared` state, so retain all old labels as text before replacing
-- only the old status checks. No conflict rows or history are deleted.
DROP POLICY IF EXISTS conflicts_manager_insert ON public.project_conflicts;
DO $drop_legacy_status_checks$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN SELECT conname FROM pg_catalog.pg_constraint
    WHERE conrelid='public.project_conflicts'::regclass AND contype='c'
      AND pg_catalog.pg_get_constraintdef(oid) ~ '\mstatus\M'
  LOOP
    EXECUTE format('ALTER TABLE public.project_conflicts DROP CONSTRAINT %I',constraint_name);
  END LOOP;
END $drop_legacy_status_checks$;
ALTER TABLE public.project_conflicts ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.project_conflicts ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.project_conflicts ALTER COLUMN status SET DEFAULT 'open';

CREATE TABLE IF NOT EXISTS public.project_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_a_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  project_b_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS detected_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS fingerprint text NOT NULL DEFAULT '';
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS overlap_start date;
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS overlap_end date;
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS spatial_reason text NOT NULL DEFAULT '';
ALTER TABLE public.project_conflicts ADD COLUMN IF NOT EXISTS distance_m double precision;

DO $constraints$
DECLARE constraint_text text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_conflicts WHERE project_a_id >= project_b_id OR project_a_id IS NULL OR project_b_id IS NULL) THEN
    RAISE EXCEPTION 'Existing conflict pairs must be non-null, distinct and canonically ordered before migration.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_conflicts GROUP BY project_a_id,project_b_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate conflict pairs exist. Reconcile their history before migration.';
  END IF;
  FOR constraint_text IN SELECT conname FROM pg_catalog.pg_constraint
    WHERE conrelid='public.project_conflicts'::regclass AND contype='c'
      AND pg_catalog.pg_get_constraintdef(oid) ~ '\mstatus\M'
  LOOP
    EXECUTE format('ALTER TABLE public.project_conflicts DROP CONSTRAINT %I',constraint_text);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.project_conflicts'::regclass AND conname='civicsync_pair_order') THEN
    ALTER TABLE public.project_conflicts ADD CONSTRAINT civicsync_pair_order CHECK (project_a_id < project_b_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.project_conflicts'::regclass AND conname='civicsync_conflict_status') THEN
    ALTER TABLE public.project_conflicts ADD CONSTRAINT civicsync_conflict_status CHECK (status IN ('open','coordinating','resolved','dismissed','cleared'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.project_conflicts'::regclass AND conname='civicsync_conflict_lifecycle') THEN
    ALTER TABLE public.project_conflicts ADD CONSTRAINT civicsync_conflict_lifecycle CHECK (
      version > 0 AND ((is_current AND status <> 'cleared') OR (NOT is_current AND status='cleared'))
      AND (status NOT IN ('resolved','dismissed') OR (resolution_note IS NOT NULL AND char_length(btrim(resolution_note)) BETWEEN 20 AND 2000))
    );
  END IF;
END $constraints$;
ALTER TABLE public.project_conflicts ALTER COLUMN project_a_id SET NOT NULL;
ALTER TABLE public.project_conflicts ALTER COLUMN project_b_id SET NOT NULL;
ALTER TABLE public.project_conflicts ALTER COLUMN reason SET NOT NULL;
ALTER TABLE public.project_conflicts ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.project_conflicts ALTER COLUMN status SET DEFAULT 'open';
CREATE UNIQUE INDEX IF NOT EXISTS civicsync_conflict_pair_unique ON public.project_conflicts(project_a_id,project_b_id);
CREATE INDEX IF NOT EXISTS civicsync_conflict_b_idx ON public.project_conflicts(project_b_id);
CREATE INDEX IF NOT EXISTS civicsync_conflict_status_idx ON public.project_conflicts(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS civicsync_projects_area_idx ON public.projects USING gist(work_area);
CREATE INDEX IF NOT EXISTS civicsync_projects_schedule_idx ON public.projects(start_date,end_date) WHERE status IN ('planned','ongoing','delayed');
CREATE INDEX IF NOT EXISTS civicsync_projects_segment_idx ON public.projects(road_segment_id);
CREATE INDEX IF NOT EXISTS civicsync_updates_order_idx ON public.project_updates(project_id,created_at DESC,id);

CREATE TABLE IF NOT EXISTS public.conflict_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id uuid NOT NULL REFERENCES public.project_conflicts(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN ('detected','reopened','cleared','resolved','dismissed')),
  note text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  conflict_version integer NOT NULL CHECK(conflict_version>0)
);
CREATE INDEX IF NOT EXISTS civicsync_events_order_idx ON public.conflict_events(conflict_id,created_at DESC,id);

-- Reads follow visibility of BOTH projects. No public alert may expose a project
-- that Person 2's project SELECT policy hides from the current user.
ALTER TABLE public.project_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS civicsync_conflicts_read ON public.project_conflicts;
CREATE POLICY civicsync_conflicts_read ON public.project_conflicts AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_a_id)
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_b_id)
);
DROP POLICY IF EXISTS civicsync_conflicts_select ON public.project_conflicts;
CREATE POLICY civicsync_conflicts_select ON public.project_conflicts FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS civicsync_events_read ON public.conflict_events;
CREATE POLICY civicsync_events_read ON public.conflict_events AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (
  EXISTS (SELECT 1 FROM public.project_conflicts c WHERE c.id=conflict_id)
);
DROP POLICY IF EXISTS civicsync_events_select ON public.conflict_events;
CREATE POLICY civicsync_events_select ON public.conflict_events FOR SELECT TO anon,authenticated USING (true);
REVOKE ALL ON public.project_conflicts,public.conflict_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_conflicts,public.conflict_events TO anon,authenticated;
REVOKE UPDATE,DELETE ON public.projects FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,latitude,longitude,road_segment_id,work_geometry,work_area,version) ON public.projects FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.project_updates FROM PUBLIC,anon,authenticated;
REVOKE INSERT(id,project_id,status,progress_note,delay_reason,revised_end_date,updated_by,created_at),UPDATE(id,project_id,status,progress_note,delay_reason,revised_end_date,updated_by,created_at) ON public.project_updates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION civicsync_private.normalize_segment(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=''
AS $$ SELECT regexp_replace(lower(btrim(coalesce(value,''))), '\s+', ' ', 'g') $$;

CREATE OR REPLACE FUNCTION civicsync_private.work_types_conflict(a text,b text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''
AS $$ SELECT a<>'inspection' AND b<>'inspection' $$;

CREATE OR REPLACE FUNCTION civicsync_private.transition_allowed(a text,b text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''
AS $$ SELECT a=b OR CASE a
  WHEN 'planned' THEN b IN ('ongoing','delayed','cancelled')
  WHEN 'ongoing' THEN b IN ('delayed','completed','cancelled')
  WHEN 'delayed' THEN b IN ('planned','ongoing','completed','cancelled')
  ELSE false END $$;

CREATE OR REPLACE FUNCTION civicsync_private.can_manage_department(department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.approval_status::text='approved' AND (p.role::text='admin' OR (p.role::text='official' AND p.department_id=department))) $$;

CREATE OR REPLACE FUNCTION civicsync_private.lock_mutations()
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
  -- The algorithm obtains fresh READ COMMITTED snapshots after lock acquisition.
  -- Reject stronger-isolation callers instead of silently missing a concurrent row.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE='25000', MESSAGE='CivicSync project writes require READ COMMITTED isolation; retry in a fresh transaction.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(7842051,100);
END $$;

CREATE OR REPLACE FUNCTION civicsync_private.project_write_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN PERFORM civicsync_private.lock_mutations(); RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION civicsync_private.prepare_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE coords jsonb; point jsonb; first_point jsonb; kind text; lon double precision; lat double precision;
BEGIN
  IF NEW.title IS NULL OR char_length(btrim(NEW.title)) NOT BETWEEN 5 AND 160 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Project title must contain 5–160 characters.'; END IF;
  IF NEW.road_name IS NULL OR char_length(btrim(NEW.road_name)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Road name must contain 2–160 characters.'; END IF;
  IF NEW.location_description IS NOT NULL AND char_length(NEW.location_description)>500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Location must not exceed 500 characters.'; END IF;
  IF NEW.work_type IS NULL OR NEW.work_type::text NOT IN ('water','sewer','drainage','electricity','telecom','road_resurfacing','excavation','inspection','sewer_drainage','road_repair','water_pipeline','other') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unmapped work type. Reconcile the backend contract.'; END IF;
  IF NEW.status IS NULL OR NEW.status::text NOT IN ('planned','ongoing','delayed','completed','cancelled') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unmapped project status. Reconcile the backend contract.'; END IF;
  IF NEW.start_date IS NULL OR NEW.end_date IS NULL OR NOT isfinite(NEW.start_date) OR NOT isfinite(NEW.end_date) OR NEW.start_date<DATE '0001-01-01' OR NEW.end_date>DATE '9999-12-31' OR NEW.start_date>NEW.end_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Enter valid inclusive dates, with end on or after start.'; END IF;
  IF TG_OP='UPDATE' AND NOT civicsync_private.transition_allowed(OLD.status::text,NEW.status::text) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This project status transition is not allowed.'; END IF;
  NEW.title:=btrim(NEW.title); NEW.road_name:=btrim(NEW.road_name);
  NEW.road_segment_id:=nullif(civicsync_private.normalize_segment(NEW.road_segment_id),'');
  IF char_length(NEW.road_segment_id)>120 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Road segment ID must not exceed 120 characters.'; END IF;
  IF (NEW.segment_start_latitude IS NULL OR NEW.segment_start_longitude IS NULL OR NEW.segment_end_latitude IS NULL OR NEW.segment_end_longitude IS NULL)
     AND (NEW.segment_start_latitude IS NOT NULL OR NEW.segment_start_longitude IS NOT NULL OR NEW.segment_end_latitude IS NOT NULL OR NEW.segment_end_longitude IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Legacy road segment coordinates must contain both complete endpoints.';
  END IF;
  IF NEW.work_geometry IS NULL AND NEW.segment_start_latitude IS NOT NULL THEN
    NEW.work_geometry:=jsonb_build_object('type','LineString','coordinates',jsonb_build_array(
      jsonb_build_array(NEW.segment_start_longitude,NEW.segment_start_latitude),
      jsonb_build_array(NEW.segment_end_longitude,NEW.segment_end_latitude)));
    NEW.latitude:=NEW.segment_start_latitude; NEW.longitude:=NEW.segment_start_longitude;
  END IF;
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provide both latitude and longitude, or neither.'; END IF;
  IF NEW.latitude IS NOT NULL AND (NOT (NEW.latitude BETWEEN -90 AND 90) OR NOT (NEW.longitude BETWEEN -180 AND 180)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Coordinates must be finite WGS84 latitude/longitude.'; END IF;
  IF NEW.work_geometry IS NOT NULL THEN
    kind:=NEW.work_geometry->>'type'; coords:=NEW.work_geometry->'coordinates';
    IF jsonb_typeof(NEW.work_geometry) IS DISTINCT FROM 'object' OR kind IS NULL OR kind NOT IN ('Point','LineString') OR jsonb_typeof(coords) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Work geometry must be a GeoJSON Point or LineString.'; END IF;
    IF kind='Point' THEN coords:=jsonb_build_array(coords);
    ELSIF jsonb_array_length(coords) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A work line needs 2–200 points.';
    END IF;
    FOR point IN SELECT value FROM jsonb_array_elements(coords) LOOP
      IF jsonb_typeof(point) IS DISTINCT FROM 'array' OR jsonb_array_length(point)<>2 OR jsonb_typeof(point->0) IS DISTINCT FROM 'number' OR jsonb_typeof(point->1) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Each coordinate must be [longitude, latitude].'; END IF;
      lon:=(point->>0)::double precision; lat:=(point->>1)::double precision;
      IF NOT(lon BETWEEN -180 AND 180) OR NOT(lat BETWEEN -90 AND 90) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='GeoJSON coordinates are outside WGS84 bounds.'; END IF;
    END LOOP;
    IF kind='LineString' AND (SELECT count(DISTINCT value) FROM jsonb_array_elements(coords))<2 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A work line needs two distinct points.'; END IF;
    first_point:=coords->0;
    lon:=(first_point->>0)::double precision; lat:=(first_point->>1)::double precision;
    IF NEW.latitude IS NOT NULL AND (abs(NEW.latitude-lat)>0.000001 OR abs(NEW.longitude-lon)>0.000001) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Anchor coordinates must match the first coordinate in work_geometry.'; END IF;
    NEW.latitude:=lat; NEW.longitude:=lon;
    NEW.work_area:=extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(NEW.work_geometry::text),4326)::extensions.geography;
  ELSIF NEW.latitude IS NOT NULL THEN
    NEW.work_area:=extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.longitude,NEW.latitude),4326)::extensions.geography;
  ELSE NEW.work_area:=NULL;
  END IF;
  IF NEW.work_area IS NULL AND NEW.road_segment_id IS NULL AND NEW.status IN ('planned','ongoing','delayed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Active projects need valid coordinates/work geometry or a canonical road segment ID.'; END IF;
  NEW.version:=CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.version+1 END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION civicsync_private.refresh_project(project_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE p public.projects%ROWTYPE; other public.projects%ROWTYPE; a public.projects%ROWTYPE; b public.projects%ROWTYPE;
  old_conflict public.project_conflicts%ROWTYPE; saved public.project_conflicts%ROWTYPE; stale public.project_conflicts%ROWTYPE;
  signature text; spatial text; reason_text text; distance_value double precision; first_day date; last_day date;
  seen uuid[]:=ARRAY[]::uuid[]; same_segment boolean;
BEGIN
  -- All callers must hold the transaction-scoped writer lock; acquire defensively.
  PERFORM civicsync_private.lock_mutations();
  SELECT * INTO p FROM public.projects WHERE id=project_id;
  IF NOT FOUND THEN RETURN; END IF;
  p.road_segment_id:=nullif(civicsync_private.normalize_segment(p.road_segment_id),'');
  IF p.status IN ('planned','ongoing','delayed') THEN
    FOR other IN SELECT q.* FROM public.projects q
      WHERE q.id<>p.id AND q.status IN ('planned','ongoing','delayed')
        AND q.start_date<=p.end_date AND p.start_date<=q.end_date
        AND civicsync_private.work_types_conflict(p.work_type::text,q.work_type::text)
        AND ((p.road_segment_id IS NOT NULL AND civicsync_private.normalize_segment(q.road_segment_id)=p.road_segment_id)
          OR (p.work_area IS NOT NULL AND q.work_area IS NOT NULL AND extensions.ST_DWithin(p.work_area,q.work_area,30)))
      ORDER BY q.id
    LOOP
      IF p.id<other.id THEN a:=p; b:=other; ELSE a:=other; b:=p; END IF;
      a.road_segment_id:=nullif(civicsync_private.normalize_segment(a.road_segment_id),'');
      b.road_segment_id:=nullif(civicsync_private.normalize_segment(b.road_segment_id),'');
      same_segment:=a.road_segment_id IS NOT NULL AND a.road_segment_id=civicsync_private.normalize_segment(b.road_segment_id);
      distance_value:=CASE WHEN a.work_area IS NOT NULL AND b.work_area IS NOT NULL THEN extensions.ST_Distance(a.work_area,b.work_area) ELSE NULL END;
      spatial:=CASE WHEN same_segment THEN 'Shared road segment: '||a.road_segment_id ELSE 'Mapped work extents within 30 metres' END;
      first_day:=greatest(a.start_date,b.start_date); last_day:=least(a.end_date,b.end_date);
      reason_text:=format('Potential coordination overlap: %s and %s work share %s through %s. %s.', replace(a.work_type::text,'_',' '),replace(b.work_type::text,'_',' '),first_day,last_day,spatial);
      -- Status changes between active states and cosmetic title edits do not reopen
      -- an unchanged decision. Dates, extents, work types and departments do.
      signature:=encode(sha256(convert_to(jsonb_build_array(
        a.id,a.department_id,a.start_date,a.end_date,a.work_type,a.road_segment_id,extensions.ST_AsEWKT(a.work_area::extensions.geometry),
        b.id,b.department_id,b.start_date,b.end_date,b.work_type,b.road_segment_id,extensions.ST_AsEWKT(b.work_area::extensions.geometry)
      )::text,'UTF8')),'hex');
      SELECT * INTO old_conflict FROM public.project_conflicts WHERE project_a_id=a.id AND project_b_id=b.id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.project_conflicts(project_a_id,project_b_id,reason,status,fingerprint,is_current,overlap_start,overlap_end,spatial_reason,distance_m)
        VALUES(a.id,b.id,reason_text,'open',signature,true,first_day,last_day,spatial,distance_value) RETURNING * INTO saved;
        INSERT INTO public.conflict_events(conflict_id,event_type,note,fingerprint,conflict_version)
        VALUES(saved.id,'detected',reason_text,signature,saved.version);
      ELSIF old_conflict.fingerprint<>signature OR NOT old_conflict.is_current THEN
        UPDATE public.project_conflicts SET reason=reason_text,status='open',fingerprint=signature,is_current=true,
          resolution_note=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=clock_timestamp(),version=old_conflict.version+1,
          overlap_start=first_day,overlap_end=last_day,spatial_reason=spatial,distance_m=distance_value
        WHERE id=old_conflict.id RETURNING * INTO saved;
        INSERT INTO public.conflict_events(conflict_id,event_type,note,fingerprint,conflict_version)
        VALUES(saved.id,'reopened','A schedule, work extent, work type or department changed, or an overlap returned. Review this version again.',signature,saved.version);
      ELSE saved:=old_conflict;
      END IF;
      seen:=array_append(seen,saved.id);
    END LOOP;
  END IF;
  FOR stale IN SELECT * FROM public.project_conflicts c
    WHERE (c.project_a_id=project_id OR c.project_b_id=project_id) AND c.is_current AND NOT(c.id=ANY(seen)) FOR UPDATE
  LOOP
    UPDATE public.project_conflicts SET is_current=false,status='cleared',updated_at=clock_timestamp(),version=stale.version+1 WHERE id=stale.id RETURNING * INTO saved;
    INSERT INTO public.conflict_events(conflict_id,event_type,note,fingerprint,conflict_version)
    VALUES(saved.id,'cleared','The current saved project records no longer satisfy the active-work, inclusive-date and location overlap rules.',saved.fingerprint,saved.version);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION civicsync_private.project_saved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN PERFORM civicsync_private.refresh_project(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS civicsync_00_writer_lock ON public.projects;
CREATE TRIGGER civicsync_00_writer_lock BEFORE INSERT OR UPDATE OR DELETE ON public.projects FOR EACH STATEMENT EXECUTE FUNCTION civicsync_private.project_write_lock();
DROP TRIGGER IF EXISTS civicsync_10_prepare_project ON public.projects;
CREATE TRIGGER civicsync_10_prepare_project BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION civicsync_private.prepare_project();
DROP TRIGGER IF EXISTS civicsync_90_project_saved ON public.projects;
CREATE TRIGGER civicsync_90_project_saved AFTER INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION civicsync_private.project_saved();

CREATE OR REPLACE FUNCTION public.check_project_conflicts(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE department uuid; BEGIN
  PERFORM civicsync_private.lock_mutations();
  SELECT department_id INTO department FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Project not found.'; END IF;
  IF NOT civicsync_private.can_manage_department(department) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only an approved involved-department official or admin may recheck this project.'; END IF;
  PERFORM civicsync_private.refresh_project(p_project_id);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_conflict(p_conflict_id uuid,p_decision text,p_note text,p_expected_version integer,p_request_id uuid)
RETURNS public.project_conflicts LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE c public.project_conflicts%ROWTYPE; old_event public.conflict_events%ROWTYPE; dep_a uuid; dep_b uuid;
BEGIN
  PERFORM civicsync_private.lock_mutations();
  SELECT * INTO c FROM public.project_conflicts WHERE id=p_conflict_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conflict not found.'; END IF;
  SELECT department_id INTO dep_a FROM public.projects WHERE id=c.project_a_id;
  SELECT department_id INTO dep_b FROM public.projects WHERE id=c.project_b_id;
  IF NOT(civicsync_private.can_manage_department(dep_a) OR civicsync_private.can_manage_department(dep_b)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='An approved involved-department official or admin must review this conflict.'; END IF;
  IF p_request_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('resolved','dismissed') OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provide a request UUID, a valid decision and a 20–2000 character note.'; END IF;
  SELECT * INTO old_event FROM public.conflict_events WHERE id=p_request_id;
  IF FOUND THEN
    IF old_event.conflict_id<>p_conflict_id OR old_event.actor_id IS DISTINCT FROM auth.uid() OR old_event.event_type<>p_decision OR old_event.note<>btrim(p_note) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This request ID was already used for different content.'; END IF;
    RETURN c; -- Exact retry: retain any later record changes; never duplicate the event.
  END IF;
  IF p_expected_version IS NULL OR c.version<>p_expected_version OR NOT c.is_current OR c.status NOT IN ('open','coordinating') THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='The conflict changed or has already been reviewed. Reload before deciding.'; END IF;
  UPDATE public.project_conflicts SET status=p_decision,resolution_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp(),version=c.version+1 WHERE id=c.id RETURNING * INTO c;
  INSERT INTO public.conflict_events(id,conflict_id,event_type,note,actor_id,fingerprint,conflict_version)
  VALUES(p_request_id,c.id,p_decision,btrim(p_note),auth.uid(),c.fingerprint,c.version);
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.publish_project_update(p_request_id uuid,p_project_id uuid,p_expected_version integer,p_status text,p_progress_percent integer,p_progress_note text,p_delay_reason text DEFAULT NULL,p_revised_end_date date DEFAULT NULL)
RETURNS public.project_updates LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE p public.projects%ROWTYPE; u public.project_updates%ROWTYPE;
BEGIN
  PERFORM civicsync_private.lock_mutations();
  SELECT * INTO p FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Project not found.'; END IF;
  IF NOT civicsync_private.can_manage_department(p.department_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only an approved responsible-department official or admin may publish updates.'; END IF;
  IF p_request_id IS NULL OR p_status IS NULL OR p_status NOT IN ('planned','ongoing','delayed','completed','cancelled') OR p_progress_percent IS NULL OR p_progress_percent NOT BETWEEN 0 AND 100 OR (p_status='completed' AND p_progress_percent<>100) OR p_progress_note IS NULL OR char_length(btrim(p_progress_note)) NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provide a request UUID, valid status/progress percentage and a 10–3000 character progress note.'; END IF;
  p_delay_reason:=nullif(btrim(p_delay_reason),'');
  IF p_status='delayed' AND (p_delay_reason IS NULL OR char_length(p_delay_reason) NOT BETWEEN 10 AND 2000) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A delayed update requires a 10–2000 character reason.'; END IF;
  IF char_length(p_delay_reason)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Delay reason is too long.'; END IF;
  SELECT * INTO u FROM public.project_updates WHERE id=p_request_id;
  IF FOUND THEN
    IF u.project_id<>p_project_id OR u.updated_by<>auth.uid() OR u.status::text<>p_status OR u.progress_percent<>p_progress_percent OR u.progress_note<>btrim(p_progress_note) OR u.delay_reason IS DISTINCT FROM p_delay_reason OR u.revised_end_date IS DISTINCT FROM p_revised_end_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This update request ID was already used for different content.'; END IF;
    RETURN u;
  END IF;
  IF p_expected_version IS NULL OR p.version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Project changed. Reload before publishing.'; END IF;
  IF p_revised_end_date IS NOT NULL AND (NOT isfinite(p_revised_end_date) OR p_revised_end_date<p.start_date OR p_revised_end_date>DATE '9999-12-31') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revised end must be a valid date on or after the start.'; END IF;
  PERFORM set_config('civicsync.timeline_write','on',true);
  UPDATE public.projects SET status=p_status::public.project_status,progress_percent=p_progress_percent,end_date=coalesce(p_revised_end_date,end_date) WHERE id=p.id;
  PERFORM set_config('civicsync.timeline_write','off',true);
  INSERT INTO public.project_updates(id,project_id,status,progress_percent,progress_note,delay_reason,revised_end_date,updated_by)
  VALUES(p_request_id,p.id,p_status::public.project_status,p_progress_percent,btrim(p_progress_note),p_delay_reason,p_revised_end_date,auth.uid()) RETURNING * INTO u;
  RETURN u;
END $$;

CREATE OR REPLACE FUNCTION public.save_project_changes(p_project_id uuid,p_expected_version integer,p_changes jsonb)
RETURNS public.projects LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE p public.projects%ROWTYPE; saved public.projects%ROWTYPE; new_department uuid; admin_user boolean;
BEGIN
  PERFORM civicsync_private.lock_mutations();
  SELECT * INTO p FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Project not found.'; END IF;
  IF NOT civicsync_private.can_manage_department(p.department_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only an approved responsible-department official or admin may edit this project.'; END IF;
  IF p_expected_version IS NULL OR p.version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Project changed. Reload before saving.'; END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' OR NOT(p_changes ?& ARRAY['title','road_name','location_description','department_id','work_type','start_date','end_date','status','latitude','longitude','road_segment_id','work_geometry']) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provide every documented editable project field.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) AS keys(k) WHERE k NOT IN ('title','road_name','location_description','department_id','work_type','start_date','end_date','status','latitude','longitude','road_segment_id','work_geometry')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unknown project edit field.'; END IF;
  IF p_changes->>'status' IS DISTINCT FROM p.status::text THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Publish status changes through the official update workflow, with a progress note and delay reason when needed.'; END IF;
  new_department:=(p_changes->>'department_id')::uuid;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role::text='admin' AND approval_status::text='approved') INTO admin_user;
  IF new_department IS NULL OR (new_department<>p.department_id AND NOT admin_user) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only an approved administrator may reassign a project department.'; END IF;
  UPDATE public.projects SET
    title=p_changes->>'title',road_name=p_changes->>'road_name',location_description=p_changes->>'location_description',department_id=new_department,
    work_type=(p_changes->>'work_type')::public.work_type,start_date=(p_changes->>'start_date')::date,end_date=(p_changes->>'end_date')::date,
    latitude=(p_changes->>'latitude')::double precision,longitude=(p_changes->>'longitude')::double precision,
    road_segment_id=p_changes->>'road_segment_id',work_geometry=nullif(p_changes->'work_geometry','null'::jsonb)
  WHERE id=p.id RETURNING * INTO saved;
  INSERT INTO public.project_updates(project_id,status,progress_percent,progress_note,delay_reason,revised_end_date,updated_by)
  VALUES(saved.id,saved.status,saved.progress_percent,format('Project record amended. Road: %s. Work type: %s. Recorded schedule: %s through %s.',saved.road_name,replace(saved.work_type::text,'_',' '),saved.start_date,saved.end_date),NULL,
    CASE WHEN saved.end_date<>p.end_date THEN saved.end_date ELSE NULL END,auth.uid());
  RETURN saved;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA civicsync_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.check_project_conflicts(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_conflict(uuid,text,text,integer,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_project_conflict(uuid,public.conflict_status,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.publish_project_update(uuid,uuid,integer,text,integer,text,text,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_project_changes(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_project_conflicts(uuid),public.resolve_conflict(uuid,text,text,integer,uuid),public.publish_project_update(uuid,uuid,integer,text,integer,text,text,date),public.save_project_changes(uuid,integer,jsonb) TO authenticated;

-- Real-data backfill only. Invalid legacy data aborts the entire migration so the
-- dashboard cannot silently imply complete coverage when geometry is missing.
DO $backfill$
DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count FROM public.projects
  WHERE status IN ('planned','ongoing','delayed') AND work_geometry IS NULL
    AND (latitude IS NULL OR longitude IS NULL) AND nullif(civicsync_private.normalize_segment(road_segment_id),'') IS NULL;
  IF bad_count>0 THEN RAISE EXCEPTION '% active projects lack comparable locations. Backfill their coordinates or canonical segment IDs with Person 2, then rerun.',bad_count; END IF;
END $backfill$;
-- Re-running this migration need not increment every project version.
UPDATE public.projects SET latitude=latitude WHERE (work_area IS NULL AND (work_geometry IS NOT NULL OR latitude IS NOT NULL OR segment_start_latitude IS NOT NULL))
  OR road_segment_id IS DISTINCT FROM nullif(civicsync_private.normalize_segment(road_segment_id),'');
DO $sync$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.projects ORDER BY id LOOP PERFORM civicsync_private.refresh_project(r.id); END LOOP;
END $sync$;
ALTER TABLE public.project_conflicts ALTER COLUMN overlap_start SET NOT NULL;
ALTER TABLE public.project_conflicts ALTER COLUMN overlap_end SET NOT NULL;
NOTIFY pgrst, 'reload schema';
COMMIT;
