alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'invited', 'disabled'));

update public.profiles p set email = u.email
from auth.users u where p.id = u.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,firm_id,full_name,email,role,status)
 values(new.id,'00000000-0000-0000-0000-000000000001',
   coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email,
   case when not exists(select 1 from public.profiles) then 'admin' else 'staff' end,'active');
 return new;
end $$;

create or replace function public.is_firm_admin(target_firm uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and firm_id=target_firm and role='admin' and status='active')
$$;

drop policy if exists profiles_own_select on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
drop policy if exists profiles_member_select on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_member_select on public.profiles for select to authenticated
using (id=auth.uid() or public.is_firm_admin(firm_id));
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_firm_admin(firm_id)) with check (public.is_firm_admin(firm_id));

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update on public.profiles
for each row execute function public.audit_change();
