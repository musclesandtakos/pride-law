create or replace function private.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path='' as $$
  select firm_id
  from public.profiles
  where id = auth.uid()
    and status = 'active'
$$;

create or replace function private.is_firm_admin(target_firm uuid)
returns boolean
language sql
stable
security definer
set search_path='' as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and firm_id = target_firm
      and role = 'admin'
      and status = 'active'
  )
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.current_firm_id() from public, anon, authenticated;
grant execute on function private.current_firm_id() to authenticated;

revoke all on function private.is_firm_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_firm_admin(uuid) to authenticated;

drop policy if exists profiles_own_select on public.profiles;
drop policy if exists profiles_member_select on public.profiles;
drop policy if exists profiles_firm_admin_select on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_own_select
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_firm_admin_select
on public.profiles
for select
to authenticated
using (private.is_firm_admin(firm_id));

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (private.is_firm_admin(firm_id))
with check (private.is_firm_admin(firm_id));

drop policy if exists document_templates_select on public.document_templates;
drop policy if exists document_templates_insert on public.document_templates;
drop policy if exists document_templates_update on public.document_templates;
drop policy if exists document_templates_delete on public.document_templates;

create policy document_templates_select
on public.document_templates
for select
to authenticated
using (
  firm_id = (select private.current_firm_id())
);

create policy document_templates_insert
on public.document_templates
for insert
to authenticated
with check (
  firm_id = (select private.current_firm_id())
  and private.is_firm_admin(firm_id)
);

create policy document_templates_update
on public.document_templates
for update
to authenticated
using (
  firm_id = (select private.current_firm_id())
  and private.is_firm_admin(firm_id)
)
with check (
  firm_id = (select private.current_firm_id())
  and private.is_firm_admin(firm_id)
);

create policy document_templates_delete
on public.document_templates
for delete
to authenticated
using (
  firm_id = (select private.current_firm_id())
  and private.is_firm_admin(firm_id)
);

drop policy if exists document_templates_bucket_select on storage.objects;
drop policy if exists document_templates_bucket_insert on storage.objects;
drop policy if exists document_templates_bucket_delete on storage.objects;

create policy document_templates_bucket_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
);

create policy document_templates_bucket_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
  and private.is_firm_admin((select private.current_firm_id()))
);

create policy document_templates_bucket_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = (select private.current_firm_id())::text
  and private.is_firm_admin((select private.current_firm_id()))
);

drop function if exists public.is_firm_admin(uuid);

create index if not exists document_templates_uploaded_by_idx
  on public.document_templates(uploaded_by);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path='' as $$
begin
  insert into public.profiles(id, firm_id, full_name, email, role, status)
  values(
    new.id,
    '00000000-0000-0000-0000-000000000001',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when not exists(select 1 from public.profiles) then 'admin' else 'staff' end,
    case when new.invited_at is not null then 'invited' else 'active' end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end $$;

create or replace function public.handle_invited_user_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path='' as $$
begin
  if old.invited_at is not null
     and old.email_confirmed_at is null
     and new.email_confirmed_at is not null then
    update public.profiles
    set status = 'active'
    where id = new.id
      and status = 'invited';
  end if;

  return new;
end $$;

revoke all on function public.handle_invited_user_email_confirmation() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
execute procedure public.handle_invited_user_email_confirmation();
