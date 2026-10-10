-- Synthetic demo records only. Replace demo contacts, locations and schedules with verified local data.
insert into public.departments(id,name,contact_email,contact_phone) values
 ('10000000-0000-4000-8000-000000000001','Public Works Department','pwd@example.gov','+91-80-5550-0101'),
 ('10000000-0000-4000-8000-000000000002','Water Supply and Sewerage','water@example.gov','+91-80-5550-0102'),
 ('10000000-0000-4000-8000-000000000003','Electricity and Street Lighting','power@example.gov','+91-80-5550-0103'),
 ('10000000-0000-4000-8000-000000000004','Telecommunications','telecom@example.gov','+91-80-5550-0104')
on conflict(id) do update set name=excluded.name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone;

insert into public.projects(id,title,description,road_name,location_description,latitude,longitude,segment_start_latitude,segment_start_longitude,segment_end_latitude,segment_end_longitude,work_type,department_id,start_date,end_date,status,progress_percent,contractor_name) values
 ('20000000-0000-4000-8000-000000000001','Demo: resurfacing Lakeview Road','Synthetic sample project for CivicSync demonstration.','Lakeview Road','Between Central Market and the library',12.9718,77.5942,12.9708,77.5929,12.9731,77.5963,'road_repair','10000000-0000-4000-8000-000000000001',current_date+2,current_date+24,'planned',0,'Demo contractor'),
 ('20000000-0000-4000-8000-000000000002','Demo: water main replacement','Synthetic sample project demonstrating schedule coordination.','Lakeview Road','Near Central Market',12.9719,77.5941,12.9712,77.5932,12.9726,77.5951,'water_pipeline','10000000-0000-4000-8000-000000000002',current_date+8,current_date+18,'planned',0,'Demo utility contractor'),
 ('20000000-0000-4000-8000-000000000003','Demo: drain desilting','Synthetic sample project for dashboard testing.','Garden Street','South ward',12.9687,77.6011,null,null,null,null,'sewer_drainage','10000000-0000-4000-8000-000000000002',current_date-30,current_date-4,'delayed',65,'Demo contractor')
on conflict(id) do update set title=excluded.title,description=excluded.description,road_name=excluded.road_name,location_description=excluded.location_description,
work_type=excluded.work_type,department_id=excluded.department_id,start_date=excluded.start_date,end_date=excluded.end_date;

-- Include an explicit reason and revised deadline for the synthetic delayed example.
insert into public.project_updates(project_id,status,progress_percent,progress_note,delay_reason,revised_end_date)
select '20000000-0000-4000-8000-000000000003','delayed',65,
       'Demo update: work is waiting for a utility inspection.',
       'Demo delay reason: inspection rescheduled; this is synthetic data.',current_date-1
where not exists(select 1 from public.project_updates where project_id='20000000-0000-4000-8000-000000000003');
