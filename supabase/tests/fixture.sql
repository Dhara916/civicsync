-- TEST-ONLY Person 2 contract fixture. Not a production backend or Supabase Auth.
-- This file intentionally creates test identities and records in a DISPOSABLE DB.
DO $$ BEGIN
  IF current_database() NOT LIKE 'civicsync_test_%' THEN RAISE EXCEPTION 'Refusing fixture initialization outside a civicsync_test_* database.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
-- A fresh test DB is required. Existing public core tables intentionally cause failure.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
-- Some PostGIS Docker images preinstall the extension in public. Only in this empty
-- disposable test database, remove it before the deployment migration creates its
-- expected extensions-schema installation. This is NEVER in the production migration.
DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TYPE public.project_status AS ENUM ('planned','ongoing','delayed','completed','cancelled');
CREATE TYPE public.work_type AS ENUM ('road_repair','water_pipeline','sewer_drainage','electricity','telecom','other');
CREATE TYPE public.report_category AS ENUM ('quality','safety','delay','damage','other');
CREATE TYPE public.report_status AS ENUM ('open','under_review','resolved','dismissed');
CREATE TYPE public.conflict_status AS ENUM ('open','coordinating','resolved','dismissed');
CREATE FUNCTION public.resolve_project_conflict(uuid,public.conflict_status,text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE TABLE public.departments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,contact_email text,contact_phone text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,name text,full_name text,role text NOT NULL CHECK(role IN ('citizen','official','admin')),department_id uuid REFERENCES public.departments(id),approval_status text NOT NULL CHECK(approval_status IN ('approved','pending','rejected')));
CREATE TABLE public.projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,road_name text NOT NULL,location_description text,latitude double precision,longitude double precision,segment_start_latitude double precision,segment_start_longitude double precision,segment_end_latitude double precision,segment_end_longitude double precision,work_type public.work_type NOT NULL,department_id uuid NOT NULL REFERENCES public.departments(id),start_date date NOT NULL,end_date date NOT NULL,status public.project_status NOT NULL DEFAULT 'planned',progress_percent smallint NOT NULL DEFAULT 0);
CREATE TABLE public.project_updates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),status public.project_status NOT NULL,progress_percent smallint NOT NULL DEFAULT 0,progress_note text NOT NULL,delay_reason text,revised_end_date date,updated_by uuid REFERENCES public.profiles(id));
CREATE TABLE public.citizen_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),project_id uuid NOT NULL REFERENCES public.projects(id),category public.report_category NOT NULL,description text NOT NULL CHECK(char_length(btrim(description)) BETWEEN 20 AND 3000),status public.report_status NOT NULL DEFAULT 'open',created_at timestamptz NOT NULL DEFAULT now());
-- Exercise the migration path for Person 2's empty minimal conflicts table.
CREATE TABLE public.project_conflicts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_a_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,project_b_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,reason text NOT NULL,status public.conflict_status NOT NULL DEFAULT 'open',resolution_note text,reviewed_by uuid REFERENCES public.profiles(id));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY public_departments ON public.departments FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY public_projects ON public.projects FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY staff_insert_projects ON public.projects FOR INSERT TO authenticated WITH CHECK(status IN ('planned','ongoing') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.approval_status='approved' AND (p.role='admin' OR (p.role='official' AND p.department_id=projects.department_id))));
CREATE POLICY public_updates ON public.project_updates FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY own_reports ON public.citizen_reports FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY insert_own_reports ON public.citizen_reports FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='submitted' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.approval_status='approved'));
GRANT SELECT ON public.departments,public.projects,public.project_updates TO anon,authenticated;
GRANT SELECT ON public.profiles,public.citizen_reports TO authenticated;
GRANT INSERT ON public.projects,public.citizen_reports TO authenticated;
INSERT INTO public.departments(id,name) VALUES('10000000-0000-4000-8000-000000000001','Test Water Department'),('10000000-0000-4000-8000-000000000002','Test Roads Department'),('10000000-0000-4000-8000-000000000003','Test Electricity Department');
INSERT INTO public.profiles(id,name,role,department_id,approval_status) VALUES
('20000000-0000-4000-8000-000000000001','Test citizen one','citizen',NULL,'approved'),
('20000000-0000-4000-8000-000000000002','Test official A','official','10000000-0000-4000-8000-000000000001','approved'),
('20000000-0000-4000-8000-000000000003','Test official B','official','10000000-0000-4000-8000-000000000002','approved'),
('20000000-0000-4000-8000-000000000004','Test unrelated official','official','10000000-0000-4000-8000-000000000003','approved'),
('20000000-0000-4000-8000-000000000005','Test pending official','official','10000000-0000-4000-8000-000000000001','pending'),
('20000000-0000-4000-8000-000000000006','Test admin','admin',NULL,'approved'),
('20000000-0000-4000-8000-000000000007','Test citizen two','citizen',NULL,'approved');
