create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'General',
  placeholder_fields text[] not null default '{}',
  sort_order integer not null default 0,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_templates_firm_order_idx
  on public.document_templates(firm_id, category, sort_order, created_at desc);

alter table public.document_templates enable row level security;

create policy document_templates_select on public.document_templates
for select to authenticated
using (firm_id = (select private.current_firm_id()));

create policy document_templates_insert on public.document_templates
for insert to authenticated
with check (firm_id = (select private.current_firm_id()) and public.is_firm_admin(firm_id));

create policy document_templates_update on public.document_templates
for update to authenticated
using (firm_id = (select private.current_firm_id()) and public.is_firm_admin(firm_id))
with check (firm_id = (select private.current_firm_id()) and public.is_firm_admin(firm_id));

create policy document_templates_delete on public.document_templates
for delete to authenticated
using (firm_id = (select private.current_firm_id()) and public.is_firm_admin(firm_id));

create trigger document_templates_touch
before update on public.document_templates
for each row execute function public.touch_updated_at();

create trigger document_templates_audit
after insert or update or delete on public.document_templates
for each row execute function public.audit_change();

insert into storage.buckets(id,name,public)
values('document-templates','document-templates',false)
on conflict do nothing;

create policy document_templates_bucket_select on storage.objects
for select to authenticated
using (
  bucket_id='document-templates'
  and (storage.foldername(name))[1]=public.current_firm_id()::text
);

create policy document_templates_bucket_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='document-templates'
  and (storage.foldername(name))[1]=public.current_firm_id()::text
);

create policy document_templates_bucket_delete on storage.objects
for delete to authenticated
using (
  bucket_id='document-templates'
  and (storage.foldername(name))[1]=public.current_firm_id()::text
);
