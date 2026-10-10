-- Apply after schema.sql. Re-run only after dropping these named policies if resetting a database.
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.citizen_reports enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_conflicts enable row level security;
alter table public.project_audit_log enable row level security;

create policy departments_public_read on public.departments for select to anon,authenticated using(true);
create policy departments_admin_manage on public.departments for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
create policy profiles_self_or_admin_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.current_user_role()='admin');
create policy profiles_self_name_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
revoke insert,update,delete on public.profiles from anon,authenticated;
grant update(full_name) on public.profiles to authenticated;

create policy projects_public_read on public.projects for select to anon,authenticated using(true);
create policy projects_manager_insert on public.projects for insert to authenticated with check(public.is_project_manager(department_id) and (created_by is null or created_by=(select auth.uid())));
create policy projects_manager_update on public.projects for update to authenticated using(public.is_project_manager(department_id)) with check(public.is_project_manager(department_id));
create policy projects_admin_delete on public.projects for delete to authenticated using(public.current_user_role()='admin');

create policy reports_owner_and_manager_read on public.citizen_reports for select to authenticated using(
 user_id=(select auth.uid()) or exists(select 1 from public.projects p where p.id=project_id and public.is_project_manager(p.department_id))
);
create policy reports_owner_insert on public.citizen_reports for insert to authenticated with check(
 user_id=(select auth.uid()) and status='open' and reviewed_by is null and reviewed_at is null and official_response is null
);
revoke update,delete on public.citizen_reports from anon,authenticated;

create policy updates_public_read on public.project_updates for select to anon,authenticated using(true);
create policy updates_manager_insert on public.project_updates for insert to authenticated with check(
 exists(select 1 from public.projects p where p.id=project_id and public.is_project_manager(p.department_id)) and (updated_by is null or updated_by=(select auth.uid()))
);
revoke update,delete on public.project_updates from anon,authenticated;

create policy conflicts_public_read on public.project_conflicts for select to anon,authenticated using(true);
create policy conflicts_manager_insert on public.project_conflicts for insert to authenticated with check(
 status='open' and resolution_note is null and reviewed_by is null and reviewed_at is null and
 (exists(select 1 from public.projects p where p.id=project_a_id and public.is_project_manager(p.department_id))
 or exists(select 1 from public.projects p where p.id=project_b_id and public.is_project_manager(p.department_id)))
);
revoke update,delete on public.project_conflicts from anon,authenticated;
create policy audit_admin_read on public.project_audit_log for select to authenticated using(public.current_user_role()='admin');
revoke insert,update,delete on public.project_audit_log from anon,authenticated;

-- Optional citizen photos. Private bucket; max 5 MB; JPEG/PNG/WebP only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('civic-report-photos','civic-report-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy report_photo_owner_upload on storage.objects for insert to authenticated with check(
 bucket_id='civic-report-photos' and (storage.foldername(name))[1]='reports' and (storage.foldername(name))[2]=(select auth.uid())::text
);
create policy report_photo_authorized_read on storage.objects for select to authenticated using(
 bucket_id='civic-report-photos' and ((storage.foldername(name))[1]='reports' and (storage.foldername(name))[2]=(select auth.uid())::text
 or public.current_user_role()='admin' or exists(select 1 from public.citizen_reports r join public.projects p on p.id=r.project_id where r.photo_path=name and public.is_project_manager(p.department_id)))
);
