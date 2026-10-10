-- Run and commit this migration before conflict_detection.sql.
-- It only adds the detailed Person 1 work/report labels while preserving every
-- value and record from Person 2's existing enums. It is safe to re-run.
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'water';
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'sewer';
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'drainage';
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'road_resurfacing';
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'excavation';
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'inspection';
ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'safety_hazard';
ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'road_damage';
ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'water_leak';
ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'access_blocked';
ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'noise';
