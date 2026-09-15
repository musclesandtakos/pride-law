create table public.client_intake_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_name text not null check (char_length(recipient_name) between 2 and 160),
  recipient_email text not null,
  practice_area text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_intake_responses (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null unique references public.client_intake_links(id) on delete restrict,
  firm_id uuid not null references public.firms(id) on delete cascade,
  intake_id uuid references public.intakes(id) on delete set null,
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  preferred_name text,
  pronouns text,
  date_of_birth date,
  email text not null,
  phone text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  preferred_contact text check (preferred_contact in ('Email', 'Phone', 'Text')),
  practice_area text not null,
  incident_date date,
  incident_location text,
  opposing_parties text,
  matter_summary text not null check (char_length(matter_summary) between 20 and 10000),
  injuries_or_damages text,
  insurance_information text,
  referral_source text,
  consent_to_contact boolean not null check (consent_to_contact),
  signature_name text not null check (char_length(signature_name) between 2 and 200),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index client_intake_links_firm_created_idx
  on public.client_intake_links(firm_id, created_at desc);
create index client_intake_links_created_by_idx
  on public.client_intake_links(created_by);
create index client_intake_links_open_idx
  on public.client_intake_links(token_hash)
  where submitted_at is null and revoked_at is null;
create index client_intake_responses_firm_submitted_idx
  on public.client_intake_responses(firm_id, submitted_at desc);
create index client_intake_responses_intake_idx
  on public.client_intake_responses(intake_id)
  where intake_id is not null;

alter table public.client_intake_links enable row level security;
alter table public.client_intake_responses enable row level security;

revoke all on public.client_intake_links from anon, authenticated;
revoke all on public.client_intake_responses from anon, authenticated;

grant select, insert, update, delete on public.client_intake_links to authenticated;
grant select on public.client_intake_responses to authenticated;
grant select (id, firm_id, recipient_name, recipient_email, practice_area, expires_at, submitted_at, revoked_at)
  on public.client_intake_links to anon;
grant insert (
  link_id, firm_id, legal_name, preferred_name, pronouns, date_of_birth, email, phone,
  address_line_1, address_line_2, city, state, postal_code, preferred_contact,
  practice_area, incident_date, incident_location, opposing_parties, matter_summary,
  injuries_or_damages, insurance_information, referral_source, consent_to_contact,
  signature_name
) on public.client_intake_responses to anon;

create or replace function private.request_intake_token_hash()
returns text
language sql
stable
security invoker
set search_path = '' as $$
  select nullif(
    coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-intake-token',
    ''
  )
$$;

revoke all on function private.request_intake_token_hash() from public, authenticated;
grant usage on schema private to anon;
grant execute on function private.request_intake_token_hash() to anon;

create policy client_intake_links_firm_select
on public.client_intake_links
for select
to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_intake_links_firm_insert
on public.client_intake_links
for insert
to authenticated
with check (
  firm_id = (select private.current_firm_id())
  and created_by = (select auth.uid())
);

create policy client_intake_links_firm_update
on public.client_intake_links
for update
to authenticated
using (firm_id = (select private.current_firm_id()))
with check (firm_id = (select private.current_firm_id()));

create policy client_intake_links_firm_delete
on public.client_intake_links
for delete
to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_intake_links_public_open
on public.client_intake_links
for select
to anon
using (
  token_hash = (select private.request_intake_token_hash())
  and submitted_at is null
  and revoked_at is null
  and expires_at > now()
);

create policy client_intake_responses_firm_select
on public.client_intake_responses
for select
to authenticated
using (firm_id = (select private.current_firm_id()));

create policy client_intake_responses_public_insert
on public.client_intake_responses
for insert
to anon
with check (
  consent_to_contact = true
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

create or replace function public.handle_client_intake_response()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  created_intake_id uuid;
begin
  insert into public.intakes (
    firm_id,
    name,
    email,
    phone,
    practice_area,
    source,
    stage,
    notes
  ) values (
    new.firm_id,
    coalesce(nullif(btrim(new.preferred_name), ''), new.legal_name),
    new.email,
    new.phone,
    new.practice_area,
    coalesce(nullif(btrim(new.referral_source), ''), 'Client intake link'),
    'New',
    concat_ws(E'\n',
      'Legal name: ' || new.legal_name,
      case when new.pronouns is not null then 'Pronouns: ' || new.pronouns end,
      case when new.date_of_birth is not null then 'Date of birth: ' || new.date_of_birth::text end,
      case when new.incident_date is not null then 'Incident date: ' || new.incident_date::text end,
      case when new.incident_location is not null then 'Incident location: ' || new.incident_location end,
      case when new.opposing_parties is not null then 'Conflict names: ' || new.opposing_parties end,
      'Matter summary: ' || new.matter_summary,
      case when new.injuries_or_damages is not null then 'Injuries or damages: ' || new.injuries_or_damages end,
      case when new.insurance_information is not null then 'Insurance: ' || new.insurance_information end,
      'Client consented to contact and electronically signed as: ' || new.signature_name
    )
  ) returning id into created_intake_id;

  update public.client_intake_responses
  set intake_id = created_intake_id
  where id = new.id;

  update public.client_intake_links
  set submitted_at = new.submitted_at,
      updated_at = now()
  where id = new.link_id;

  return null;
end
$$;

revoke all on function public.handle_client_intake_response() from public, anon, authenticated;

create trigger client_intake_response_received
after insert on public.client_intake_responses
for each row execute function public.handle_client_intake_response();

create trigger client_intake_links_touch
before update on public.client_intake_links
for each row execute function public.touch_updated_at();
