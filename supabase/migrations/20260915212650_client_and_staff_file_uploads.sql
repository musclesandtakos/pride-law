alter table public.documents
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists mime_type text,
  add column if not exists file_size bigint check (file_size is null or file_size between 1 and 10485760);

create index if not exists documents_client_idx on public.documents(client_id);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);

create table public.client_intake_attachments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.client_intake_links(id) on delete restrict,
  firm_id uuid not null references public.firms(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 240),
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index client_intake_attachments_link_idx
  on public.client_intake_attachments(link_id, created_at);
create index client_intake_attachments_firm_idx
  on public.client_intake_attachments(firm_id, created_at desc);
create index client_intake_attachments_document_idx
  on public.client_intake_attachments(document_id)
  where document_id is not null;

alter table public.client_intake_attachments enable row level security;
revoke all on public.client_intake_attachments from anon, authenticated;
grant select, insert, delete on public.client_intake_attachments to authenticated;
grant insert (link_id, firm_id, storage_path, file_name, mime_type, file_size)
  on public.client_intake_attachments to anon;

create policy client_intake_attachments_firm_select
on public.client_intake_attachments
for select
to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_intake_attachments_firm_insert
on public.client_intake_attachments
for insert
to authenticated
with check (firm_id = (select private.current_firm_id()));

create policy client_intake_attachments_firm_delete
on public.client_intake_attachments
for delete
to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_intake_attachments_public_insert
on public.client_intake_attachments
for insert
to anon
with check (
  storage_path = firm_id::text || '/' || link_id::text || '/' || storage.filename(storage_path)
  and storage.filename(storage_path) ~ '^[1-5]$'
  and exists (
    select 1
    from public.client_intake_links link
    where link.id = link_id
      and link.firm_id = firm_id
      and link.token_hash = (select private.request_intake_token_hash())
      and link.submitted_at is null
      and link.revoked_at is null
      and link.expires_at > now()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-files',
  'case-files',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy case_files_staff_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
);

create policy case_files_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
);

create policy case_files_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
);

create policy case_files_client_insert
on storage.objects
for insert
to anon
with check (
  bucket_id = 'case-files'
  and storage.filename(name) ~ '^[1-5]$'
  and exists (
    select 1
    from public.client_intake_links link
    where link.firm_id::text = (storage.foldername(name))[1]
      and link.id::text = (storage.foldername(name))[2]
      and link.token_hash = (select private.request_intake_token_hash())
      and link.submitted_at is null
      and link.revoked_at is null
      and link.expires_at > now()
  )
);

create policy case_files_client_delete
on storage.objects
for delete
to anon
using (
  bucket_id = 'case-files'
  and storage.filename(name) ~ '^[1-5]$'
  and exists (
    select 1
    from public.client_intake_links link
    where link.firm_id::text = (storage.foldername(name))[1]
      and link.id::text = (storage.foldername(name))[2]
      and link.token_hash = (select private.request_intake_token_hash())
      and link.submitted_at is null
      and link.revoked_at is null
      and link.expires_at > now()
  )
);

create or replace function public.handle_client_intake_attachment()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  created_document_id uuid;
  recipient text;
begin
  select recipient_name into recipient
  from public.client_intake_links
  where id = new.link_id;

  insert into public.documents (
    firm_id,
    name,
    storage_path,
    document_type,
    status,
    owner_name,
    mime_type,
    file_size
  ) values (
    new.firm_id,
    new.file_name,
    new.storage_path,
    case when new.mime_type like 'image/%' then 'Client photo' else 'Client document' end,
    'Client upload',
    recipient,
    new.mime_type,
    new.file_size
  ) returning id into created_document_id;

  update public.client_intake_attachments
  set document_id = created_document_id
  where id = new.id;

  return null;
end
$$;

revoke all on function public.handle_client_intake_attachment() from public, anon, authenticated;

create trigger client_intake_attachment_received
after insert on public.client_intake_attachments
for each row execute function public.handle_client_intake_attachment();
