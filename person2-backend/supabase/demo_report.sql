-- Optional synthetic report for a dedicated demo citizen account.
-- Replace the email with the test account's email. Do not attach a demo report to an actual resident account.
insert into public.citizen_reports(user_id,project_id,category,description)
select p.id,'20000000-0000-4000-8000-000000000001','safety',
       'Demo report: temporary barriers are missing near the work zone entrance.'
from public.profiles p join auth.users u on u.id=p.id
where lower(u.email)=lower('DEMO_CITIZEN_EMAIL_HERE') and p.role='citizen'
and not exists (
  select 1 from public.citizen_reports r where r.user_id=p.id
    and r.project_id='20000000-0000-4000-8000-000000000001'
    and r.description='Demo report: temporary barriers are missing near the work zone entrance.'
);
