-- Public intake callers must not receive SELECT access to token_hash. Policies on
-- other tables therefore validate the capability through this narrow private
-- predicate instead of querying client_intake_links as the anon role.
create or replace function private.is_valid_client_intake_link(
  requested_link_id text,
  requested_firm_id text,
  requested_token_hash text
)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.client_intake_links link
    where link.id::text = requested_link_id
      and link.firm_id::text = requested_firm_id
      and link.token_hash = requested_token_hash
      and link.submitted_at is null
      and link.revoked_at is null
      and link.expires_at > now()
  )
$$;

revoke all on function private.is_valid_client_intake_link(text, text, text)
  from public, anon, authenticated;
grant execute on function private.is_valid_client_intake_link(text, text, text)
  to anon;

drop policy if exists client_intake_responses_public_insert
  on public.client_intake_responses;
create policy client_intake_responses_public_insert
on public.client_intake_responses
for insert
to anon
with check (
  consent_to_contact = true
  and (select private.is_valid_client_intake_link(
    client_intake_responses.link_id::text,
    client_intake_responses.firm_id::text,
    (select private.request_intake_token_hash())
  ))
);

drop policy if exists client_intake_attachments_public_insert
  on public.client_intake_attachments;
create policy client_intake_attachments_public_insert
on public.client_intake_attachments
for insert
to anon
with check (
  client_intake_attachments.storage_path =
    client_intake_attachments.firm_id::text || '/' ||
    client_intake_attachments.link_id::text || '/' ||
    storage.filename(client_intake_attachments.storage_path)
  and storage.filename(client_intake_attachments.storage_path) ~ '^[1-5]$'
  and (select private.is_valid_client_intake_link(
    client_intake_attachments.link_id::text,
    client_intake_attachments.firm_id::text,
    (select private.request_intake_token_hash())
  ))
);

drop policy if exists case_files_client_insert on storage.objects;
create policy case_files_client_insert
on storage.objects
for insert
to anon
with check (
  bucket_id = 'case-files'
  and storage.filename(name) ~ '^[1-5]$'
  and (select private.is_valid_client_intake_link(
    (storage.foldername(name))[2],
    (storage.foldername(name))[1],
    (select private.request_intake_token_hash())
  ))
);

drop policy if exists case_files_client_delete on storage.objects;
create policy case_files_client_delete
on storage.objects
for delete
to anon
using (
  bucket_id = 'case-files'
  and storage.filename(name) ~ '^[1-5]$'
  and (select private.is_valid_client_intake_link(
    (storage.foldername(name))[2],
    (storage.foldername(name))[1],
    (select private.request_intake_token_hash())
  ))
);
