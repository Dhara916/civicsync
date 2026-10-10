-- CivicSync initial schema. Apply once to a new Supabase project, then apply policies.sql.
create extension if not exists pgcrypto;
create type public.user_role as enum ('citizen','official','admin');
create type public.approval_status as enum ('pending','approved','rejected');
create type public.project_status as enum ('planned','ongoing','delayed','completed','cancelled');
create type public.work_type as enum ('road_repair','water_pipeline','sewer_drainage','electricity','telecom','other');
create type public.report_category as enum ('quality','safety','delay','damage','other');
create type public.report_status as enum ('open','under_review','resolved','dismissed');
create type public.conflict_status as enum ('open','coordinating','resolved','dismissed');

create table public.departments (
 id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(trim(name)) between 2 and 120),
 contact_email text, contact_phone text, created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, full_name text check (full_name is null or char_length(trim(full_name)) between 2 and 120),
 role public.user_role not null default 'citizen', department_id uuid references public.departments(id) on delete restrict,
 approval_status public.approval_status not null default 'approved', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (role <> 'official' or department_id is not null), check (role <> 'citizen' or department_id is null)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), title text not null check (char_length(trim(title)) between 3 and 160),
 description text check (description is null or char_length(description) <= 4000), road_name text not null check (char_length(trim(road_name)) between 2 and 160),
 location_description text check (location_description is null or char_length(location_description) <= 500),
 latitude double precision check (latitude is null or latitude between -90 and 90), longitude double precision check (longitude is null or longitude between -180 and 180),
 segment_start_latitude double precision check (segment_start_latitude is null or segment_start_latitude between -90 and 90),
 segment_start_longitude double precision check (segment_start_longitude is null or segment_start_longitude between -180 and 180),
 segment_end_latitude double precision check (segment_end_latitude is null or segment_end_latitude between -90 and 90),
 segment_end_longitude double precision check (segment_end_longitude is null or segment_end_longitude between -180 and 180),
 work_type public.work_type not null, department_id uuid not null references public.departments(id) on delete restrict,
 start_date date not null, end_date date not null, actual_end_date date, revised_end_date date,
 status public.project_status not null default 'planned', progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
 contractor_name text check (contractor_name is null or char_length(contractor_name) <= 160), created_by uuid default auth.uid() references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (end_date >= start_date), check (actual_end_date is null or actual_end_date >= start_date),
 check (revised_end_date is null or revised_end_date >= start_date), check (status <> 'completed' or progress_percent = 100)
);
create table public.citizen_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade, category public.report_category not null,
 description text not null check (char_length(trim(description)) between 10 and 4000),
 photo_path text check (photo_path is null or (photo_path like 'reports/' || user_id::text || '/%' and char_length(photo_path) <= 500)),
 status public.report_status not null default 'open', official_response text check (official_response is null or char_length(official_response) <= 2000),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.project_updates (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 status public.project_status not null, progress_percent smallint not null check (progress_percent between 0 and 100),
 progress_note text not null check (char_length(trim(progress_note)) between 3 and 2000),
 delay_reason text check (delay_reason is null or char_length(delay_reason) <= 1000), revised_end_date date,
 updated_by uuid default auth.uid() references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
 check (status <> 'delayed' or nullif(trim(delay_reason), '') is not null), check (status <> 'completed' or progress_percent = 100)
);
create table public.project_conflicts (
 id uuid primary key default gen_random_uuid(), project_a_id uuid not null references public.projects(id) on delete cascade,
 project_b_id uuid not null references public.projects(id) on delete cascade,
 reason text not null check (char_length(trim(reason)) between 10 and 2000), status public.conflict_status not null default 'open',
 resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now(),
 check (project_a_id <> project_b_id), check (project_a_id < project_b_id),
 check (status not in ('resolved','dismissed') or nullif(trim(resolution_note), '') is not null), unique (project_a_id, project_b_id)
);
create table public.project_audit_log (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, actor_id uuid references public.profiles(id) on delete set null,
 action text not null check (action in ('insert','update','delete')), old_values jsonb, new_values jsonb, created_at timestamptz not null default now()
);
create index projects_department_status_idx on public.projects(department_id,status);
create index projects_schedule_idx on public.projects(start_date,end_date);
create index projects_road_idx on public.projects(lower(road_name));
create index reports_user_created_idx on public.citizen_reports(user_id,created_at desc);
create index reports_project_status_idx on public.citizen_reports(project_id,status);
create index updates_project_created_idx on public.project_updates(project_id,created_at desc);
create index conflicts_status_idx on public.project_conflicts(status,created_at desc);
create index audit_project_created_idx on public.project_audit_log(project_id,created_at desc);

-- SECURITY DEFINER helpers avoid recursive profile RLS. Functions use an empty search_path and qualified names.
create or replace function public.current_user_role() returns public.user_role language sql stable security definer set search_path = '' as $$
 select p.role from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' $$;
create or replace function public.current_user_department() returns uuid language sql stable security definer set search_path = '' as $$
 select p.department_id from public.profiles p where p.id=(select auth.uid()) and p.role='official' and p.approval_status='approved' $$;
create or replace function public.is_project_manager(p_department_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(public.current_user_role()='admin' or (public.current_user_role()='official' and public.current_user_department()=p_department_id),false) $$;
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_department() from public;
revoke all on function public.is_project_manager(uuid) from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_department() to authenticated;
grant execute on function public.is_project_manager(uuid) to authenticated;

create or replace function public.create_profile_for_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,role,approval_status) values(new.id,nullif(trim(new.raw_user_meta_data->>'full_name'),''),'citizen','approved') on conflict(id) do nothing;
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_auth_user();
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

create or replace function public.audit_project_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='INSERT' then insert into public.project_audit_log(project_id,actor_id,action,new_values) values(new.id,(select auth.uid()),'insert',to_jsonb(new)); return new;
 elsif TG_OP='UPDATE' then insert into public.project_audit_log(project_id,actor_id,action,old_values,new_values) values(new.id,(select auth.uid()),'update',to_jsonb(old),to_jsonb(new)); return new;
 else insert into public.project_audit_log(project_id,actor_id,action,old_values) values(old.id,(select auth.uid()),'delete',to_jsonb(old)); return old; end if;
end $$;
create trigger projects_audit after insert or update or delete on public.projects for each row execute function public.audit_project_change();
create or replace function public.apply_project_update() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform set_config('civicsync.timeline_write','on',true);
 update public.projects set status=new.status,progress_percent=new.progress_percent,revised_end_date=coalesce(new.revised_end_date,revised_end_date),
 actual_end_date=case when new.status='completed' then current_date else actual_end_date end where id=new.project_id;
 perform set_config('civicsync.timeline_write','off',true);
 return new;
end $$;
create trigger project_update_sync after insert on public.project_updates for each row execute function public.apply_project_update();
create or replace function public.require_project_timeline_for_status_change() returns trigger language plpgsql set search_path = '' as $$
begin
 if (new.status,new.progress_percent,new.revised_end_date,new.actual_end_date) is distinct from (old.status,old.progress_percent,old.revised_end_date,old.actual_end_date)
    and current_setting('civicsync.timeline_write',true) is distinct from 'on' then
   raise exception 'Use project_updates to change status, progress, or completion dates';
 end if;
 return new;
end $$;
create trigger projects_timeline_guard before update on public.projects for each row execute function public.require_project_timeline_for_status_change();

create or replace function public.get_dashboard_stats()
returns table(planned_projects bigint,ongoing_projects bigint,overdue_projects bigint,open_reports bigint,open_conflicts bigint)
language sql stable security definer set search_path = '' as $$
 select count(*) filter(where p.status='planned'),count(*) filter(where p.status in ('ongoing','delayed')),
 count(*) filter(where p.status in ('planned','ongoing','delayed') and coalesce(p.revised_end_date,p.end_date)<current_date),
 (select count(*) from public.citizen_reports r where r.status in ('open','under_review')),
 (select count(*) from public.project_conflicts c where c.status in ('open','coordinating')) from public.projects p $$;

create or replace function public.review_citizen_report(p_report_id uuid,p_status public.report_status,p_response text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_department uuid;
begin
 if p_status not in ('under_review','resolved','dismissed') then raise exception 'Invalid report status'; end if;
 select p.department_id into v_department from public.citizen_reports r join public.projects p on p.id=r.project_id where r.id=p_report_id;
 if v_department is null or not public.is_project_manager(v_department) then raise exception 'Not authorized'; end if;
 if p_response is not null and char_length(trim(p_response))>2000 then raise exception 'Response too long'; end if;
 update public.citizen_reports set status=p_status,official_response=nullif(trim(p_response),''),reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_report_id;
end $$;
create or replace function public.approve_official(p_user_id uuid,p_department_id uuid,p_approval public.approval_status default 'approved')
returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.current_user_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
 update public.profiles set role='official',department_id=p_department_id,approval_status=p_approval where id=p_user_id;
 if not found then raise exception 'Profile not found'; end if;
end $$;
create or replace function public.request_official_access(p_department_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.profiles set role='official',department_id=p_department_id,approval_status='pending'
 where id=(select auth.uid()) and (role='citizen' or (role='official' and approval_status='rejected'));
 if not found then raise exception 'Profile cannot request official access'; end if;
end $$;
create or replace function public.resolve_project_conflict(p_conflict_id uuid,p_status public.conflict_status,p_resolution_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_a uuid; v_b uuid;
begin
 if p_status not in ('coordinating','resolved','dismissed') then raise exception 'Invalid conflict status'; end if;
 if char_length(trim(coalesce(p_resolution_note,'')))<3 or char_length(p_resolution_note)>2000 then raise exception 'A resolution note is required'; end if;
 select a.department_id,b.department_id into v_a,v_b from public.project_conflicts c join public.projects a on a.id=c.project_a_id join public.projects b on b.id=c.project_b_id where c.id=p_conflict_id;
 if v_a is null or not(public.is_project_manager(v_a) or public.is_project_manager(v_b)) then raise exception 'Not authorized'; end if;
 update public.project_conflicts set status=p_status,resolution_note=trim(p_resolution_note),reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_conflict_id;
end $$;
revoke all on function public.get_dashboard_stats() from public;
revoke all on function public.review_citizen_report(uuid,public.report_status,text) from public;
revoke all on function public.approve_official(uuid,uuid,public.approval_status) from public;
revoke all on function public.request_official_access(uuid) from public;
revoke all on function public.resolve_project_conflict(uuid,public.conflict_status,text) from public;
grant execute on function public.get_dashboard_stats() to anon,authenticated;
grant execute on function public.review_citizen_report(uuid,public.report_status,text) to authenticated;
grant execute on function public.approve_official(uuid,uuid,public.approval_status) to authenticated;
grant execute on function public.request_official_access(uuid) to authenticated;
grant execute on function public.resolve_project_conflict(uuid,public.conflict_status,text) to authenticated;
