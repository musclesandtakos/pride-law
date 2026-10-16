-- Source files stay in the firm's existing private template bucket.
alter table public.document_templates
 add column file_format text not null default 'docx' check(file_format in ('pdf','docx','doc')),
 add column field_schema jsonb not null default '[]'::jsonb check(jsonb_typeof(field_schema)='array'),
 add column review_status text not null default 'needs_review' check(review_status in ('needs_review','ready')),
 add column review_note text,
 add column source_checksum text;
create unique index document_templates_import_checksum_idx on public.document_templates(firm_id,source_checksum) where source_checksum is not null;

create table public.client_forms (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id),
 client_id uuid not null references public.clients(id),
 matter_id uuid not null references public.matters(id),
 template_id uuid not null references public.document_templates(id) on delete restrict,
 source_intake_response_id uuid references public.client_intake_responses(id),
 template_name text not null,
 file_format text not null check(file_format in ('pdf','docx')),
 storage_path text not null,
 fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields)>0),
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=12000000),
 status text not null default 'draft' check(status in ('draft','completed')),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null references public.profiles(id),
 completed_by uuid references public.profiles(id),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status='completed')=(completed_at is not null and completed_by is not null))
);
create index client_forms_client_idx on public.client_forms(firm_id,client_id,updated_at desc);
create index client_forms_matter_idx on public.client_forms(matter_id);
create index client_forms_template_idx on public.client_forms(template_id);
create index client_forms_created_by_idx on public.client_forms(created_by);
create index client_forms_completed_by_idx on public.client_forms(completed_by) where completed_by is not null;
create index client_forms_source_intake_idx on public.client_forms(source_intake_response_id) where source_intake_response_id is not null;
create index client_forms_storage_idx on public.client_forms(storage_path);
alter table public.client_forms enable row level security;
revoke all on public.client_forms from public,anon,authenticated;
grant select,insert,update on public.client_forms to authenticated;
create policy client_forms_select on public.client_forms for select to authenticated
 using(firm_id=(select private.current_firm_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active' and not p.must_change_password));
create policy client_forms_insert on public.client_forms for insert to authenticated
 with check(firm_id=(select private.current_firm_id()) and created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','attorney','staff') and p.status='active' and not p.must_change_password));
create policy client_forms_update on public.client_forms for update to authenticated
 using(firm_id=(select private.current_firm_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','attorney','staff') and p.status='active' and not p.must_change_password))
 with check(firm_id=(select private.current_firm_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','attorney','staff') and p.status='active' and not p.must_change_password));

create function public.guard_client_form() returns trigger language plpgsql security invoker set search_path='' as $$
declare t public.document_templates; question jsonb;
begin
 if tg_op='INSERT' then
  select * into t from public.document_templates where id=new.template_id and firm_id=new.firm_id and review_status='ready';
  if not found or jsonb_array_length(t.field_schema)=0 or t.file_format not in ('pdf','docx') then raise exception 'Template needs review'; end if;
  if not exists(select 1 from public.clients where id=new.client_id and firm_id=new.firm_id)
   or not exists(select 1 from public.matters where id=new.matter_id and client_id=new.client_id and firm_id=new.firm_id)
   or (new.source_intake_response_id is not null and not exists(select 1 from public.client_intake_responses where id=new.source_intake_response_id and firm_id=new.firm_id)) then raise exception 'Client, matter and intake must belong to this firm'; end if;
  new.template_name=t.name;new.storage_path=t.storage_path;new.file_format=t.file_format;new.fields=t.field_schema;
  new.created_by=auth.uid();new.status='draft';new.completed_by=null;new.completed_at=null;new.revision=1;
 else
  if old.status='completed' then raise exception 'Completed forms are immutable'; end if;
  if (to_jsonb(new)-array['answers','status','revision','completed_by','completed_at','updated_at']) is distinct from (to_jsonb(old)-array['answers','status','revision','completed_by','completed_at','updated_at']) then raise exception 'Form snapshot cannot change'; end if;
  new.revision=old.revision+1;
 end if;
 if exists(select 1 from jsonb_each(new.answers) a where jsonb_typeof(a.value)<>'string' or not exists(select 1 from jsonb_array_elements(new.fields) f where f->>'key'=a.key)) then raise exception 'Invalid form answer'; end if;
 for question in select value from jsonb_array_elements(new.fields) loop
  if new.status='completed' and coalesce((question->>'required')::boolean,true) and btrim(coalesce(new.answers->>(question->>'key'),''))='' then raise exception 'Required answer missing'; end if;
 end loop;
 if new.status='completed' then new.completed_by=auth.uid();new.completed_at=now();else new.completed_by=null;new.completed_at=null;end if;
 new.updated_at=now();return new;
end $$;
revoke all on function public.guard_client_form() from public,anon,authenticated;
create trigger client_forms_guard before insert or update on public.client_forms for each row execute function public.guard_client_form();
-- Answers remain only in their protected row; do not duplicate them into the general audit log.
create function private.audit_client_form() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(firm_id,table_name,record_id,action,actor_id,actor_email,changed_data)
 values(new.firm_id,'client_forms',new.id,lower(tg_op),auth.uid(),auth.jwt()->>'email',jsonb_build_object('client_id',new.client_id,'template_id',new.template_id,'status',new.status,'revision',new.revision));
 return new;
end $$;
revoke all on function private.audit_client_form() from public,anon,authenticated;
create trigger client_forms_audit after insert or update on public.client_forms for each row execute function private.audit_client_form();

-- A template's bytes cannot be removed while any client form uses its snapshot.
drop policy if exists document_templates_bucket_delete on storage.objects;
create policy document_templates_bucket_delete on storage.objects for delete to authenticated
 using(bucket_id='document-templates' and (storage.foldername(name))[1]=(select private.current_firm_id())::text and private.is_firm_admin((select private.current_firm_id())) and not exists(select 1 from public.client_forms f where f.storage_path=name));
