alter table public.document_templates add column if not exists subsection text not null default 'General forms';
comment on column public.document_templates.subsection is 'Secondary grouping shown beneath the template category in the form selection workflow.';
create index if not exists document_templates_firm_section_idx on public.document_templates(firm_id,category,subsection,sort_order,created_at desc);
