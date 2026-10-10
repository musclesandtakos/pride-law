-- Storage's bulk-remove route must be able to locate the objects before its
-- DELETE policy can run. Limit SELECT to the same active intake capability and
-- exact firm/link folder. Access disappears after submission, expiry, or revoke.
drop policy if exists case_files_client_delete_select on storage.objects;
create policy case_files_client_select
on storage.objects
for select
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
