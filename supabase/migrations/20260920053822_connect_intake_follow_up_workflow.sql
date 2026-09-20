alter table public.tasks
  add column intake_id uuid references public.intakes(id) on delete set null;

alter table public.events
  add column intake_id uuid references public.intakes(id) on delete set null;

create index tasks_intake_open_idx
  on public.tasks(intake_id, due_date)
  where intake_id is not null and status <> 'Completed';

create index events_intake_starts_idx
  on public.events(intake_id, starts_at)
  where intake_id is not null;

create or replace function public.handle_client_intake_response()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  created_intake_id uuid;
  intake_display_name text;
begin
  intake_display_name := coalesce(nullif(btrim(new.preferred_name), ''), new.legal_name);

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
    intake_display_name,
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

  insert into public.tasks (
    firm_id,
    intake_id,
    title,
    due_date,
    priority,
    status,
    notes
  ) values (
    new.firm_id,
    created_intake_id,
    'Follow up with ' || intake_display_name,
    (new.submitted_at at time zone 'America/New_York')::date + 1,
    'High',
    'Open',
    'Automatically created when the client submitted the secure intake form.'
  );

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

insert into public.tasks (firm_id, intake_id, title, due_date, priority, status, notes)
select
  intake.firm_id,
  intake.id,
  'Follow up with ' || intake.name,
  (response.submitted_at at time zone 'America/New_York')::date + 1,
  'High',
  'Open',
  'Automatically created for an intake submitted before the follow-up workflow was enabled.'
from public.client_intake_responses response
join public.intakes intake on intake.id = response.intake_id
where not exists (
  select 1 from public.tasks task where task.intake_id = intake.id
);

create or replace function public.schedule_intake_consultation(
  p_intake_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = '' as $$
declare
  intake_record record;
  created_event_id uuid;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'The appointment end time must be after its start time.';
  end if;

  select id, firm_id, name, email, phone
  into intake_record
  from public.intakes
  where id = p_intake_id
    and firm_id = (select private.current_firm_id());

  if not found then
    raise exception 'Intake not found or unavailable.';
  end if;

  select id into created_event_id
  from public.events
  where intake_id = intake_record.id
    and event_type = 'Initial consultation'
    and starts_at >= now()
  order by starts_at
  limit 1;

  if created_event_id is null then
    insert into public.events (
      firm_id,
      intake_id,
      title,
      starts_at,
      ends_at,
      event_type,
      location,
      notes
    ) values (
      intake_record.firm_id,
      intake_record.id,
      'Initial consultation — ' || intake_record.name,
      p_starts_at,
      p_ends_at,
      'Initial consultation',
      nullif(btrim(p_location), ''),
      concat_ws(E'\n',
        nullif(btrim(p_notes), ''),
        case when intake_record.email is not null then 'Email: ' || intake_record.email end,
        case when intake_record.phone is not null then 'Phone: ' || intake_record.phone end
      )
    ) returning id into created_event_id;
  else
    update public.events
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        location = nullif(btrim(p_location), ''),
        notes = concat_ws(E'\n',
          nullif(btrim(p_notes), ''),
          case when intake_record.email is not null then 'Email: ' || intake_record.email end,
          case when intake_record.phone is not null then 'Phone: ' || intake_record.phone end
        )
    where id = created_event_id;
  end if;

  update public.intakes
  set stage = 'Appointment scheduled'
  where id = intake_record.id;

  return created_event_id;
end
$$;

revoke all on function public.schedule_intake_consultation(uuid, timestamptz, timestamptz, text, text)
  from public, anon;
grant execute on function public.schedule_intake_consultation(uuid, timestamptz, timestamptz, text, text)
  to authenticated;

create or replace function public.complete_intake_follow_up()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  if new.stage in ('Appointment scheduled', 'Retained', 'Declined')
    and new.stage is distinct from old.stage then
    update public.tasks
    set status = 'Completed'
    where intake_id = new.id
      and status <> 'Completed';
  end if;
  return new;
end
$$;

revoke all on function public.complete_intake_follow_up() from public, anon, authenticated;

create trigger intake_stage_completes_follow_up
after update of stage on public.intakes
for each row execute function public.complete_intake_follow_up();
