create table public.ringcentral_connections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null unique references public.firms(id) on delete cascade,
  account_id text not null,
  extension_id text not null,
  extension_name text,
  from_number text,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  webhook_subscription_id text,
  webhook_secret_hash text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ringcentral_connections is
  'Server-only RingCentral OAuth connection metadata and encrypted credentials.';

alter table public.ringcentral_connections enable row level security;
revoke all on table public.ringcentral_connections from anon, authenticated;
grant all on table public.ringcentral_connections to service_role;

create trigger ringcentral_connections_touch
before update on public.ringcentral_connections
for each row execute function public.touch_updated_at();

create table public.client_communications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null check (channel in ('call', 'sms', 'note')),
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  status text not null default 'logged',
  from_number text,
  to_number text,
  subject text,
  notes text,
  summary text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  ringcentral_id text,
  ringcentral_session_id text,
  recording_id text,
  recording_available boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, ringcentral_id)
);

create index client_communications_client_started_idx
  on public.client_communications (client_id, started_at desc);
create index client_communications_firm_session_idx
  on public.client_communications (firm_id, ringcentral_session_id)
  where ringcentral_session_id is not null;

alter table public.client_communications enable row level security;
revoke all on table public.client_communications from anon, authenticated;
grant select, insert, update on table public.client_communications to authenticated;
grant all on table public.client_communications to service_role;

create policy client_communications_select
on public.client_communications for select to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_communications_insert
on public.client_communications for insert to authenticated
with check (
  firm_id = (select private.current_firm_id())
  and client_id in (
    select id from public.clients where firm_id = (select private.current_firm_id())
  )
);

create policy client_communications_update
on public.client_communications for update to authenticated
using (firm_id = (select private.current_firm_id()))
with check (
  firm_id = (select private.current_firm_id())
  and client_id in (
    select id from public.clients where firm_id = (select private.current_firm_id())
  )
);

create trigger client_communications_touch
before update on public.client_communications
for each row execute function public.touch_updated_at();

create trigger client_communications_audit
after insert or update or delete on public.client_communications
for each row execute function public.audit_change();
