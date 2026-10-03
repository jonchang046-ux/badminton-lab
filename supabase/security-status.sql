-- Read-only audit of Badminton Lab objects. Run after migration in life-tools SQL Editor.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_select,
 has_table_privilege('anon',c.oid,'INSERT') as anon_can_insert
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('badminton_profiles','badminton_rackets','badminton_stringing_records','badminton_user_options','badminton_import_runs')
order by c.relname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename like 'badminton_%' order by tablename;
select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.badminton_stringing_records'::regclass and contype='f';
