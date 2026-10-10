-- Read-only inspection to run against Person 2's database BEFORE the migration.
SELECT table_name,column_name,data_type,udt_schema,udt_name,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public'
AND table_name IN ('profiles','departments','projects','citizen_reports','project_updates','project_conflicts')
ORDER BY table_name,ordinal_position;
SELECT n.nspname AS schema_name,e.extname,e.extversion FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN ('postgis','pgcrypto');
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';
SELECT conrelid::regclass AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid,conname;
SELECT event_object_table,trigger_name,action_timing,event_manipulation,action_statement FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name;
SELECT routine_name,routine_type,data_type FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name;
