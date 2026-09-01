alter table public.firms enable row level security;
create policy firms_member_select on public.firms for select to authenticated using(id=(select private.current_firm_id()));
alter function public.touch_updated_at() set search_path='';
revoke all on function public.touch_updated_at() from public, anon, authenticated;
