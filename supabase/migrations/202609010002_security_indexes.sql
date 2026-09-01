create schema if not exists private;
create or replace function private.current_firm_id() returns uuid language sql stable security definer set search_path='' as $$ select firm_id from public.profiles where id=(select auth.uid()) $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_change() from public, anon, authenticated;
revoke all on function private.current_firm_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_firm_id() to authenticated;

do $$ declare t text; begin
 foreach t in array array['clients','matters','intakes','tasks','events','documents','time_entries','invoices'] loop
  execute format('drop policy if exists %I on public.%I',t||'_select',t);
  execute format('drop policy if exists %I on public.%I',t||'_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_update',t);
  execute format('drop policy if exists %I on public.%I',t||'_delete',t);
  execute format('create policy %I on public.%I for select to authenticated using (firm_id=(select private.current_firm_id()))',t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=(select private.current_firm_id()))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (firm_id=(select private.current_firm_id())) with check (firm_id=(select private.current_firm_id()))',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (firm_id=(select private.current_firm_id()))',t||'_delete',t);
 end loop;
end $$;
drop policy if exists profiles_own_select on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_select on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists audit_firm_select on public.audit_log;
create policy audit_firm_select on public.audit_log for select to authenticated using(firm_id=(select private.current_firm_id()));
drop policy if exists matter_documents_select on storage.objects;
drop policy if exists matter_documents_insert on storage.objects;
create policy matter_documents_select on storage.objects for select to authenticated using(bucket_id='matter-documents' and (storage.foldername(name))[1]=(select private.current_firm_id())::text);
create policy matter_documents_insert on storage.objects for insert to authenticated with check(bucket_id='matter-documents' and (storage.foldername(name))[1]=(select private.current_firm_id())::text);
drop function public.current_firm_id();

create index if not exists profiles_firm_idx on public.profiles(firm_id);
create index if not exists clients_firm_idx on public.clients(firm_id);
create index if not exists matters_firm_idx on public.matters(firm_id);
create index if not exists matters_client_idx on public.matters(client_id);
create index if not exists intakes_firm_idx on public.intakes(firm_id);
create index if not exists tasks_firm_idx on public.tasks(firm_id);
create index if not exists tasks_matter_idx on public.tasks(matter_id);
create index if not exists events_firm_idx on public.events(firm_id);
create index if not exists events_matter_idx on public.events(matter_id);
create index if not exists documents_firm_idx on public.documents(firm_id);
create index if not exists documents_matter_idx on public.documents(matter_id);
create index if not exists time_entries_firm_idx on public.time_entries(firm_id);
create index if not exists time_entries_matter_idx on public.time_entries(matter_id);
create index if not exists invoices_firm_idx on public.invoices(firm_id);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_matter_idx on public.invoices(matter_id);
create index if not exists audit_log_firm_idx on public.audit_log(firm_id);
