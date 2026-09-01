create extension if not exists pgcrypto;

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
insert into public.firms (id,name,slug) values ('00000000-0000-0000-0000-000000000001','Pride Law','pride-law') on conflict do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid not null references public.firms(id),
  full_name text,
  role text not null default 'staff' check (role in ('admin','attorney','staff','billing','readonly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,firm_id,full_name,role)
 values(new.id,'00000000-0000-0000-0000-000000000001',coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),case when not exists(select 1 from public.profiles) then 'admin' else 'staff' end);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.current_firm_id() returns uuid language sql stable security definer set search_path='' as $$ select firm_id from public.profiles where id=auth.uid() $$;

create table public.clients (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 name text not null, email text, phone text, address text, preferred_contact text, status text not null default 'Active',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.matters (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null, matter_number text, name text not null, practice_area text,
 stage text not null default 'Intake', priority text not null default 'Normal', responsible_attorney text, opened_date date,
 next_deadline date, description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(firm_id,matter_number)
);
create table public.intakes (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 name text not null, email text, phone text, practice_area text, source text, stage text not null default 'New',
 owner_name text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid references public.matters(id) on delete cascade, title text not null, assignee_name text, due_date date,
 priority text not null default 'Normal', status text not null default 'Open', notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.events (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid references public.matters(id) on delete cascade, title text not null, starts_at timestamptz, ends_at timestamptz,
 event_type text, location text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid references public.matters(id) on delete cascade, name text not null, storage_path text, document_type text,
 status text not null default 'Draft', version text default '1.0', owner_name text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.time_entries (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid references public.matters(id) on delete cascade, entry_date date, timekeeper_name text, description text not null,
 hours numeric(8,2) not null default 0 check(hours>=0), rate numeric(12,2) not null default 0 check(rate>=0),
 billable boolean not null default true, billed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null, matter_id uuid references public.matters(id) on delete set null,
 invoice_number text, issue_date date, due_date date, status text not null default 'Draft',
 amount numeric(12,2) not null default 0 check(amount>=0), balance numeric(12,2) not null default 0 check(balance>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(firm_id,invoice_number)
);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 table_name text not null, record_id uuid, action text not null, actor_id uuid, actor_email text,
 changed_data jsonb, created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; f_id uuid; r_id uuid;
begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 f_id=(row_data->>'firm_id')::uuid;r_id=(row_data->>'id')::uuid;
 insert into public.audit_log(firm_id,table_name,record_id,action,actor_id,actor_email,changed_data)
 values(f_id,tg_table_name,r_id,lower(tg_op),auth.uid(),auth.jwt()->>'email',row_data-'firm_id');
 return case when tg_op='DELETE' then old else new end;
end $$;

do $$ declare t text; begin
 foreach t in array array['profiles','clients','matters','intakes','tasks','events','documents','time_entries','invoices','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
 foreach t in array array['clients','matters','intakes','tasks','events','documents','time_entries','invoices'] loop
  execute format('create policy %I on public.%I for select to authenticated using (firm_id=public.current_firm_id())',t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=public.current_firm_id())',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (firm_id=public.current_firm_id()) with check (firm_id=public.current_firm_id())',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (firm_id=public.current_firm_id())',t||'_delete',t);
  execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',t||'_touch',t);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_change()',t||'_audit',t);
 end loop;
end $$;
create policy profiles_own_select on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy audit_firm_select on public.audit_log for select to authenticated using(firm_id=public.current_firm_id());

insert into storage.buckets(id,name,public) values('matter-documents','matter-documents',false) on conflict do nothing;
create policy matter_documents_select on storage.objects for select to authenticated using(bucket_id='matter-documents' and (storage.foldername(name))[1]=public.current_firm_id()::text);
create policy matter_documents_insert on storage.objects for insert to authenticated with check(bucket_id='matter-documents' and (storage.foldername(name))[1]=public.current_firm_id()::text);
