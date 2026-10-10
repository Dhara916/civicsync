-- Execute only through npm run test:sql in a disposable test DB.
DO $$ BEGIN IF current_database() NOT LIKE 'civicsync_test_%' THEN RAISE EXCEPTION 'Wrong test database.'; END IF; END $$;
CREATE FUNCTION public.test_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION public.test_error(statement text,expected_code text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
    IF actual<>expected_code THEN RAISE EXCEPTION 'FAIL: % expected %, received % (%)',label,expected_code,actual,SQLERRM; END IF;
    RAISE NOTICE 'PASS: %',label; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: % expected an error, but operation succeeded',label;
END $$;
INSERT INTO public.projects(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,latitude,longitude) VALUES
('30000000-0000-4000-8000-000000000001','Test water main','Main road','Test locality','water','10000000-0000-4000-8000-000000000001','2030-01-01','2030-01-10','planned',13,77),
('30000000-0000-4000-8000-000000000002','Test telecom duct','Main road','Test locality','telecom','10000000-0000-4000-8000-000000000002','2030-01-10','2030-01-20','planned',13.0001,77);
SELECT public.test_assert((SELECT count(*)=1 FROM public.project_conflicts),'inclusive boundary and geospatial match persist one conflict');
SELECT public.test_assert((SELECT project_a_id<project_b_id AND overlap_start=DATE '2030-01-10' AND overlap_end=DATE '2030-01-10' FROM public.project_conflicts),'canonical order and exact one-day intersection');
SET ROLE anon;
SELECT public.test_assert((SELECT count(*)=1 FROM public.project_conflicts),'anonymous public conflict reads');
SELECT public.test_error($q$SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001')$q$,'42501','anonymous cannot run protected RPC');
SELECT public.test_error($q$UPDATE public.project_conflicts SET status='dismissed'$q$,'42501','direct conflict writes denied');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
SELECT public.test_error($q$SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001')$q$,'42501','citizen cannot recheck as an official');
SELECT public.test_error($q$UPDATE public.profiles SET role='admin'$q$,'42501','citizen cannot promote their own role');
SELECT public.test_error($q$INSERT INTO public.citizen_reports(user_id,project_id,category,description) VALUES('20000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000001','other','This report attempts to impersonate another citizen.')$q$,'42501','citizen cannot impersonate a report author');
INSERT INTO public.citizen_reports(user_id,project_id,category,description) VALUES('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','other','A test citizen observed an unmarked trench at the entrance.');
SELECT public.test_assert((SELECT count(*)=1 FROM public.citizen_reports),'citizen can read their saved report');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000007',false);
SELECT public.test_assert((SELECT count(*)=0 FROM public.citizen_reports),'second citizen cannot read the first citizen report');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',false);
SELECT public.test_error($q$SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001')$q$,'42501','unrelated department cannot recheck');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000005',false);
SELECT public.test_error($q$SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001')$q$,'42501','pending official cannot recheck');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001');
SELECT public.check_project_conflicts('30000000-0000-4000-8000-000000000001');
SELECT public.test_assert((SELECT count(*)=1 AND max(version)=1 FROM public.project_conflicts),'rechecking is idempotent');
SELECT public.test_assert((SELECT count(*)=1 FROM public.conflict_events),'rechecks do not duplicate detection history');
SELECT public.test_error($q$UPDATE public.projects SET end_date='2030-01-15'$q$,'42501','direct project edits are routed through RPCs');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
SELECT public.resolve_conflict((SELECT id FROM public.project_conflicts),'resolved','The involved departments agreed to coordinate the work sequence.',1,'40000000-0000-4000-8000-000000000001');
SELECT public.test_assert((SELECT status='resolved' AND reviewed_by='20000000-0000-4000-8000-000000000003' AND version=2 FROM public.project_conflicts),'involved second department can resolve; actor is server-derived');
SELECT public.resolve_conflict((SELECT id FROM public.project_conflicts),'resolved','The involved departments agreed to coordinate the work sequence.',1,'40000000-0000-4000-8000-000000000001');
SELECT public.test_assert((SELECT count(*)=2 FROM public.conflict_events),'exact decision retry does not duplicate history');
SELECT public.test_error($q$SELECT public.resolve_conflict((SELECT id FROM public.project_conflicts),'resolved','Different content cannot reuse the same completed request identifier.',1,'40000000-0000-4000-8000-000000000001')$q$,'22023','changed decision payload cannot reuse a request ID');
RESET ROLE;
UPDATE public.projects SET title='Renamed test water main' WHERE id='30000000-0000-4000-8000-000000000001';
SELECT public.test_assert((SELECT status='resolved' AND version=2 FROM public.project_conflicts),'cosmetic project edits preserve the reviewed fingerprint');
UPDATE public.projects SET end_date='2030-01-12' WHERE id='30000000-0000-4000-8000-000000000001';
SELECT public.test_assert((SELECT status='open' AND version=3 AND resolution_note IS NULL FROM public.project_conflicts),'material schedule edits reopen the same alert');
SELECT public.test_assert((SELECT count(*)=1 FROM public.conflict_events WHERE event_type='resolved'),'old resolution remains in append-only history');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
SELECT public.test_error($q$SELECT public.resolve_conflict((SELECT id FROM public.project_conflicts),'resolved','This review was based on a stale project schedule snapshot.',1,'40000000-0000-4000-8000-000000000002')$q$,'40001','stale review version is rejected');
RESET ROLE;
UPDATE public.projects SET latitude=14 WHERE id='30000000-0000-4000-8000-000000000001';
SELECT public.test_assert((SELECT status='cleared' AND NOT is_current FROM public.project_conflicts),'moving the work extent clears a no-longer-current alert');
UPDATE public.projects SET latitude=13 WHERE id='30000000-0000-4000-8000-000000000001';
SELECT public.test_assert((SELECT count(*)=1 AND bool_and(status='open') FROM public.project_conflicts),'returning overlap reuses its canonical record');
UPDATE public.projects SET end_date='2030-01-09' WHERE id='30000000-0000-4000-8000-000000000001';
SELECT public.test_assert((SELECT status='cleared' FROM public.project_conflicts),'non-overlapping adjacent dates clear the alert');
UPDATE public.projects SET end_date='2030-01-12' WHERE id='30000000-0000-4000-8000-000000000001';
-- Distinct geometry tests use distant regions to avoid unrelated cross-pairs.
INSERT INTO public.projects(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,latitude,longitude) VALUES
('30000000-0000-4000-8000-000000000003','Non-intrusive inspection','Main road','Test locality','inspection','10000000-0000-4000-8000-000000000001','2030-01-01','2030-01-20','planned',13,77),
('30000000-0000-4000-8000-000000000004','Same department sewer work','Main road','Test locality','sewer','10000000-0000-4000-8000-000000000001','2030-01-01','2030-01-20','planned',13,77),
('30000000-0000-4000-8000-000000000005','Same named distant road','Main road','Another locality','water','10000000-0000-4000-8000-000000000001','2030-01-01','2030-01-20','planned',23,87);
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000003' OR project_b_id='30000000-0000-4000-8000-000000000003'),'non-intrusive inspection excluded');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000001' AND project_b_id='30000000-0000-4000-8000-000000000004'),'same-department intrusive overlaps are not silently ignored');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000005' OR project_b_id='30000000-0000-4000-8000-000000000005'),'road name alone does not create a conflict');
INSERT INTO public.projects(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,road_segment_id) VALUES
('30000000-0000-4000-8000-000000000006','Segment water works','Segment road','Test zone','water','10000000-0000-4000-8000-000000000001','2031-01-01','2031-01-20','planned',' CITY:ROAD:  EAST '),
('30000000-0000-4000-8000-000000000007','Segment telecom works','Segment road','Test zone','telecom','10000000-0000-4000-8000-000000000002','2031-01-01','2031-01-20','planned','city:road: east');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000006' AND project_b_id='30000000-0000-4000-8000-000000000007'),'normalized shared segment works without coordinates');
INSERT INTO public.projects(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,latitude,longitude,road_segment_id) VALUES
('30000000-0000-4000-8000-000000000008','Nearby first water work','Spatial road','Test zone','water','10000000-0000-4000-8000-000000000001','2032-01-01','2032-01-20','planned',20,70,'city:seg:a'),
('30000000-0000-4000-8000-000000000009','Nearby second water work','Spatial road','Test zone','water','10000000-0000-4000-8000-000000000002','2032-01-01','2032-01-20','planned',20.0001,70,'city:seg:b');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000008' AND project_b_id='30000000-0000-4000-8000-000000000009'),'different segment labels do not mask nearby intrusive work');
INSERT INTO public.projects(id,title,road_name,location_description,work_type,department_id,start_date,end_date,status,work_geometry) VALUES
('30000000-0000-4000-8000-000000000010','Long horizontal water work','Crossing road','Test zone','water','10000000-0000-4000-8000-000000000001','2033-01-01','2033-01-20','planned','{"type":"LineString","coordinates":[[60,10],[60.02,10]]}'),
('30000000-0000-4000-8000-000000000011','Long crossing telecom work','Crossing road','Test zone','telecom','10000000-0000-4000-8000-000000000002','2033-01-01','2033-01-20','planned','{"type":"LineString","coordinates":[[60.01,9.99],[60.01,10.01]]}');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000010' AND project_b_id='30000000-0000-4000-8000-000000000011' AND distance_m<0.1),'crossing work lines are detected even when anchor pins are far apart');
SELECT public.test_error($q$UPDATE public.projects SET latitude=91 WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','database rejects invalid latitude');
SELECT public.test_error($q$UPDATE public.projects SET end_date='2029-01-01' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','database rejects reversed schedules');
SELECT public.test_error($q$UPDATE public.projects SET work_type='made_up' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','database rejects unmapped work types');
SELECT public.test_error($q$UPDATE public.projects SET work_geometry='{"type":"LineString","coordinates":[[77,13],[77,13]]}' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','database rejects duplicate-only lines');
SELECT public.test_error($q$UPDATE public.projects SET work_geometry='{"type":"Point","coordinates":[78,13]}' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','database rejects a mismatched geometry anchor');
SELECT public.test_error($q$DELETE FROM public.projects WHERE id='30000000-0000-4000-8000-000000000001'$q$,'23503','conflict history blocks destructive project deletion');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
SELECT public.publish_project_update('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',(SELECT version FROM public.projects WHERE id='30000000-0000-4000-8000-000000000001'),'ongoing',50,'Works have begun with a shortened and published work schedule.',NULL,'2030-01-05');
SELECT public.test_assert((SELECT end_date=DATE '2030-01-05' AND status='ongoing' FROM public.projects WHERE id='30000000-0000-4000-8000-000000000001'),'update RPC atomically changes the authoritative project schedule');
SELECT public.test_assert((SELECT status='cleared' FROM public.project_conflicts WHERE project_a_id='30000000-0000-4000-8000-000000000001' AND project_b_id='30000000-0000-4000-8000-000000000002'),'published schedule change automatically recalculates conflicts');
SELECT public.publish_project_update('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',-1,'ongoing',50,'Works have begun with a shortened and published work schedule.',NULL,'2030-01-05');
SELECT public.test_assert((SELECT count(*)=1 FROM public.project_updates WHERE id='50000000-0000-4000-8000-000000000001'),'update RPC exact retry does not duplicate the timeline');
SELECT public.test_error($q$SELECT public.publish_project_update('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',-1,'ongoing',50,'A stale client is attempting to overwrite the current state.',NULL,NULL)$q$,'40001','stale project update is rejected');
SELECT public.test_error($q$SELECT public.publish_project_update('50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',(SELECT version FROM public.projects WHERE id='30000000-0000-4000-8000-000000000001'),'delayed',65,'The project is delayed without any valid reason.',NULL,NULL)$q$,'22023','a delayed update requires a public reason');
SELECT public.test_error($q$SELECT public.save_project_changes(id,version,jsonb_set(to_jsonb(p)-'id'-'version'-'work_area','{department_id}','"10000000-0000-4000-8000-000000000002"')) FROM public.projects p WHERE id='30000000-0000-4000-8000-000000000001'$q$,'42501','official cannot reassign a project to another department');
SELECT public.test_error($q$SELECT public.save_project_changes(id,version,jsonb_set(to_jsonb(p)-'id'-'version'-'work_area','{status}','"delayed"')) FROM public.projects p WHERE id='30000000-0000-4000-8000-000000000001'$q$,'22023','project editor cannot bypass the status-update workflow');
RESET ROLE;
-- Visibility must remain restrictive even alongside other permissive read policies.
CREATE POLICY test_hide_project ON public.projects AS RESTRICTIVE FOR SELECT TO anon USING(id<>'30000000-0000-4000-8000-000000000002');
SET ROLE anon;
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.project_conflicts WHERE project_b_id='30000000-0000-4000-8000-000000000002'),'hidden project does not leak through conflict reads');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.conflict_events e JOIN public.project_conflicts c ON c.id=e.conflict_id WHERE c.project_b_id='30000000-0000-4000-8000-000000000002'),'hidden conflict does not leak through event history');
RESET ROLE;
DROP POLICY test_hide_project ON public.projects;
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT public.test_error($q$UPDATE public.projects SET title='Isolation test rename' WHERE id='30000000-0000-4000-8000-000000000001'$q$,'25000','unsupported write isolation is rejected rather than silently missing conflicts');
ROLLBACK;
SELECT 'SQL contract and lifecycle tests completed' AS result;

