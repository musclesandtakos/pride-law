import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const firm = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const staff = "10000000-0000-0000-0000-000000000001",
  readonly = "10000000-0000-0000-0000-000000000002";
const client = "20000000-0000-0000-0000-000000000001",
  matter = "30000000-0000-0000-0000-000000000001",
  template = "40000000-0000-0000-0000-000000000001";
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
 grant usage on schema auth,private to authenticated;
 create table public.firms(id uuid primary key);
 create table public.profiles(id uuid primary key,firm_id uuid,role text,status text,must_change_password boolean default false);
 create table public.clients(id uuid primary key,firm_id uuid);
 create table public.matters(id uuid primary key,firm_id uuid,client_id uuid);
 create table public.client_intake_responses(id uuid primary key,firm_id uuid);
 create table public.document_templates(id uuid primary key,firm_id uuid,name text,storage_path text);
 create table public.audit_log(firm_id uuid,table_name text,record_id uuid,action text,actor_id uuid,actor_email text,changed_data jsonb);
 create table storage.objects(id uuid primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 create function private.current_firm_id() returns uuid language sql stable as $$select firm_id from public.profiles where id=auth.uid() and status='active'$$;
 create function private.is_firm_admin(firm uuid) returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and firm_id=firm and role='admin')$$;
 grant select on public.profiles,public.clients,public.matters,public.document_templates,public.client_intake_responses to authenticated;
 grant usage on schema storage to authenticated;
 grant select,delete on storage.objects to authenticated;
 create policy storage_select on storage.objects for select to authenticated using(true);
 insert into public.firms values('${firm}'),('${other}');
 insert into public.profiles(id,firm_id,role,status) values('${staff}','${firm}','staff','active'),('${readonly}','${firm}','readonly','active');
 insert into public.clients values('${client}','${firm}');insert into public.matters values('${matter}','${firm}','${client}');
 insert into public.document_templates values('${template}','${firm}','Test form','${firm}/test.pdf');`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261016182458_client_form_workflow.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `update public.document_templates set file_format='pdf',review_status='ready',field_schema='[{"key":"name","label":"Name","required":true,"target":"name"}]'::jsonb;`,
  );
}, 30000);
afterAll(() => db.close());
describe.sequential("client form database boundaries", () => {
  it("takes trusted template snapshots and hides other firms", async () => {
    await asUser(staff);
    const result = await db.query<{
      id: string;
      template_name: string;
      storage_path: string;
    }>(
      `insert into public.client_forms(firm_id,client_id,matter_id,template_id,template_name,file_format,storage_path,fields,created_by) values('${firm}','${client}','${matter}','${template}','Forged name','pdf','other/secret','[]','${staff}') returning id,template_name,storage_path`,
    );
    expect(result.rows[0].template_name).toBe("Test form");
    expect(result.rows[0].storage_path).toBe(`${firm}/test.pdf`);
    await db.exec(
      `reset role;update public.profiles set firm_id='${other}' where id='${staff}';set role authenticated;`,
    );
    expect(
      (await db.query("select id from public.client_forms")).rows,
    ).toHaveLength(0);
    await db.exec(
      `reset role;update public.profiles set firm_id='${firm}' where id='${staff}';`,
    );
  });
  it("rejects cross-client matter bindings", async () => {
    await db.exec(
      `reset role;insert into public.clients values('20000000-0000-0000-0000-000000000002','${other}');`,
    );
    await asUser(staff);
    await expect(
      db.exec(
        `insert into public.client_forms(firm_id,client_id,matter_id,template_id,template_name,file_format,storage_path,fields,created_by) values('${firm}','20000000-0000-0000-0000-000000000002','${matter}','${template}','x','pdf','x','[]','${staff}')`,
      ),
    ).rejects.toThrow("Client, matter and intake");
  });
  it("denies readonly updates and requires completion answers", async () => {
    await asUser(readonly);
    expect(
      (
        await db.query(
          `update public.client_forms set answers='{"name":"changed"}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(staff);
    await expect(
      db.exec(`update public.client_forms set status='completed'`),
    ).rejects.toThrow("Required answer missing");
  });
  it("locks completed records, preserves sources and excludes answers from audit", async () => {
    await asUser(staff);
    await db.exec(
      `update public.client_forms set answers='{"name":"Sensitive answer"}',status='completed'`,
    );
    await expect(
      db.exec(`update public.client_forms set answers='{"name":"tampered"}'`),
    ).rejects.toThrow("immutable");
    await db.exec(`reset role`);
    await expect(
      db.exec(`delete from public.document_templates where id='${template}'`),
    ).rejects.toThrow();
    const logs = await db.query<{ changed_data: unknown }>(
      `select changed_data from public.audit_log`,
    );
    expect(JSON.stringify(logs.rows)).not.toContain("Sensitive answer");
  });
});
