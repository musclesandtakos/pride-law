-- The Storage delete-many endpoint first selects candidate rows. Restrict that
-- visibility to this exact operation so a public intake client can clean up a
-- partial upload without gaining list or download access.
create policy case_files_client_delete_select
on storage.objects
for select
to anon
using (
  storage.allow_only_operation('storage.object.delete_many')
  and bucket_id = 'case-files'
  and storage.filename(name) ~ '^[1-5]$'
  and (select private.is_valid_client_intake_link(
    (storage.foldername(name))[2],
    (storage.foldername(name))[1],
    (select private.request_intake_token_hash())
  ))
);
