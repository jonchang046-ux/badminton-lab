-- Apply to life-tools. Adds only badminton_* objects; does not alter household/restock tables.
begin;
create table public.badminton_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (length(display_name)<=200),
 created_at timestamptz not null default now()
);
create table public.badminton_rackets (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 brand text not null check(length(trim(brand)) between 1 and 200),
 model text not null check(length(trim(model)) between 1 and 200),
 weight text not null default '' check(length(weight)<=200),
 grip text not null default '' check(length(grip)<=200),
 notes text not null default '' check(length(notes)<=5000), active boolean not null default true,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
create table public.badminton_stringing_records (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 id uuid not null default gen_random_uuid(), racket_id uuid not null,
 date date not null check(date >= '1900-01-01'::date and date <= (now() at time zone 'Asia/Taipei')::date),
 string_brand text not null check(length(trim(string_brand)) between 1 and 200),
 string_model text not null check(length(trim(string_model)) between 1 and 200),
 main_tension numeric(4,1) not null check(main_tension between 1 and 50),
 cross_tension numeric(4,1) not null check(cross_tension between 1 and 50), mismatch boolean not null default false,
 shop text not null default '' check(length(shop)<=200), price numeric(12,2) check(price between 0 and 1000000),
 notes text not null default '' check(length(notes)<=5000), review text not null default '' check(length(review)<=5000),
 smash smallint check(smash between 1 and 10), control smallint check(control between 1 and 10),
 repulsion smallint check(repulsion between 1 and 10), comfort smallint check(comfort between 1 and 10),
 durability smallint check(durability between 1 and 10), satisfaction smallint check(satisfaction between 1 and 10),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,id), foreign key(user_id,racket_id) references public.badminton_rackets(user_id,id) on delete cascade
);
create index badminton_stringing_records_history on public.badminton_stringing_records(user_id,racket_id,date desc,created_at desc,id);
create table public.badminton_user_options (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('brand','model','weight','grip','stringBrand','stringModel')),
 parent text not null default '' check(length(parent)<=200),
 value text not null check(length(trim(value)) between 1 and 200),
 primary key(user_id,kind,parent,value)
);
create table public.badminton_import_runs (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 racket_count integer not null, record_count integer not null, imported_at timestamptz not null default now(),
 primary key(user_id,source_hash)
);
alter table public.badminton_profiles enable row level security;
alter table public.badminton_rackets enable row level security;
alter table public.badminton_stringing_records enable row level security;
alter table public.badminton_user_options enable row level security;
alter table public.badminton_import_runs enable row level security;
create policy badminton_profiles_owner on public.badminton_profiles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy badminton_rackets_owner on public.badminton_rackets for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy badminton_stringing_owner on public.badminton_stringing_records for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy badminton_options_owner on public.badminton_user_options for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy badminton_imports_owner on public.badminton_import_runs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.badminton_profiles,public.badminton_rackets,public.badminton_stringing_records,public.badminton_user_options,public.badminton_import_runs from public,anon;
grant select,insert,update,delete on public.badminton_profiles,public.badminton_rackets,public.badminton_stringing_records,public.badminton_user_options,public.badminton_import_runs to authenticated;

create function public.badminton_touch_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.version := old.version+1; new.updated_at:=now(); new.created_at:=old.created_at; return new; end $$;
create trigger badminton_rackets_version before update on public.badminton_rackets for each row execute function public.badminton_touch_version();
create trigger badminton_stringing_version before update on public.badminton_stringing_records for each row execute function public.badminton_touch_version();
create function public.badminton_remember_options() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='badminton_rackets' then
  insert into public.badminton_user_options(user_id,kind,parent,value)
  select new.user_id,x.kind,x.parent,trim(x.value) from (values ('brand','',new.brand),('model',new.brand,new.model),('weight','',new.weight),('grip','',new.grip)) x(kind,parent,value) where trim(x.value)<>'' on conflict do nothing;
 else
  insert into public.badminton_user_options(user_id,kind,parent,value) values (new.user_id,'stringBrand','',trim(new.string_brand)),(new.user_id,'stringModel',new.string_brand,trim(new.string_model)) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger badminton_racket_choices after insert or update on public.badminton_rackets for each row execute function public.badminton_remember_options();
create trigger badminton_string_choices after insert or update on public.badminton_stringing_records for each row execute function public.badminton_remember_options();

-- Single consistent snapshot, without PostgREST row-limit truncation. RLS still applies.
create function public.badminton_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception '登入後才能讀取資料' using errcode='42501'; end if;
 select jsonb_build_object('schemaVersion',2,
 'rackets',coalesce((select jsonb_agg(r order by r.created_at,r.id) from public.badminton_rackets r where r.user_id=auth.uid()),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(s order by s.date desc,s.created_at desc,s.id desc) from public.badminton_stringing_records s where s.user_id=auth.uid()),'[]'::jsonb),
 'options',coalesce((select jsonb_agg(o order by o.kind,o.value) from public.badminton_user_options o where o.user_id=auth.uid()),'[]'::jsonb)) into result;
 return result;
end $$;

-- Atomic, repeatable one-time import. user_id always comes from the authenticated JWT.
create function public.badminton_import_v1(payload jsonb, source_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); rc integer; sc integer;
begin
 if uid is null then raise exception '請先登入' using errcode='42501'; end if;
 if source_hash !~ '^[a-f0-9]{64}$' then raise exception '無效的備份識別碼'; end if;
 if jsonb_typeof(payload->'rackets') is distinct from 'array' or jsonb_typeof(payload->'records') is distinct from 'array' then raise exception '備份格式不正確'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if exists(select 1 from public.badminton_import_runs i where i.user_id=uid and i.source_hash=badminton_import_v1.source_hash) then return jsonb_build_object('alreadyImported',true); end if;
 insert into public.badminton_rackets(user_id,id,brand,model,weight,grip,notes,active,created_at)
 select uid,r.id,r.brand,r.model,coalesce(r.weight,''),coalesce(r.grip,''),coalesce(r.notes,''),r.active,coalesce(r.created_at,now())
 from jsonb_populate_recordset(null::public.badminton_rackets,payload->'rackets') r on conflict(user_id,id) do nothing;
 get diagnostics rc=row_count;
 insert into public.badminton_stringing_records(user_id,id,racket_id,date,string_brand,string_model,main_tension,cross_tension,mismatch,shop,price,notes,review,smash,control,repulsion,comfort,durability,satisfaction,created_at)
 select uid,s.id,s.racket_id,s.date,s.string_brand,s.string_model,s.main_tension,s.cross_tension,s.mismatch,coalesce(s.shop,''),s.price,coalesce(s.notes,''),coalesce(s.review,''),s.smash,s.control,s.repulsion,s.comfort,s.durability,s.satisfaction,coalesce(s.created_at,now())
 from jsonb_populate_recordset(null::public.badminton_stringing_records,payload->'records') s on conflict(user_id,id) do nothing;
 get diagnostics sc=row_count;
 insert into public.badminton_import_runs(user_id,source_hash,racket_count,record_count) values(uid,badminton_import_v1.source_hash,rc,sc);
 return jsonb_build_object('alreadyImported',false,'rackets',rc,'records',sc);
end $$;
-- Live security test can inspect flags, but no other project tables or private data.
create function public.badminton_security_status() returns table(table_name text,rls_enabled boolean,anon_can_select boolean,anon_can_insert boolean)
language sql stable security invoker set search_path='' as $$
 select c.relname::text,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('anon',c.oid,'INSERT')
 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where auth.uid() is not null and n.nspname='public' and c.relname in ('badminton_profiles','badminton_rackets','badminton_stringing_records','badminton_user_options','badminton_import_runs') order by c.relname;
$$;
revoke all on function public.badminton_touch_version(),public.badminton_remember_options(),public.badminton_snapshot(),public.badminton_import_v1(jsonb,text),public.badminton_security_status() from public,anon;
grant execute on function public.badminton_snapshot(),public.badminton_import_v1(jsonb,text),public.badminton_security_status() to authenticated;
comment on table public.badminton_rackets is 'Badminton Lab V2 private equipment';
comment on table public.badminton_stringing_records is 'Badminton Lab V2 private stringing and review history';
commit;
