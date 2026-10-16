/** Run only against Pride Law. Sources and manifest must stay outside this public repo. */
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2];
if (!root)
  throw new Error(
    "Usage: node scripts/import-client-form-templates.mjs /private/path/to/import-pack",
  );
const expectedProject = "zclcprdhqqyqfgkuexfh";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== `https://${expectedProject}.supabase.co`)
  throw new Error("Import requires Pride Law's current Supabase project URL.");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Set the server-only SUPABASE_SERVICE_ROLE_KEY in your shell. Never put it in a file or commit.",
  );
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: firm, error } = await db
  .from("firms")
  .select("id,name,slug")
  .eq("slug", "pride-law")
  .single();
if (error || !firm)
  throw new Error("Pride Law firm record could not be verified.");
const bucket = await db.storage.getBucket("document-templates");
if (bucket.error || bucket.data.public)
  throw new Error("The document-templates bucket must exist and be private.");
const manifest = JSON.parse(
  await readFile(resolve(root, "manifest.json"), "utf8"),
);
if (
  manifest.version !== 1 ||
  !Array.isArray(manifest.templates) ||
  manifest.templates.length > 50
)
  throw new Error("Invalid import manifest.");
let imported = 0,
  skipped = 0;
for (const [index, item] of manifest.templates.entries()) {
  const path = resolve(root, item.file);
  const rel = relative(resolve(root), path);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Source path must be inside the private import pack.");
  const bytes = await readFile(path);
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Source is too large.");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== item.sha256)
    throw new Error("A source checksum does not match its manifest.");
  const prior = await db
    .from("document_templates")
    .select("id")
    .eq("firm_id", firm.id)
    .eq("source_checksum", checksum)
    .maybeSingle();
  if (prior.error)
    throw new Error(
      "Apply the client form workflow migration before importing.",
    );
  if (prior.data) {
    skipped++;
    continue;
  }
  const storagePath = `${firm.id}/imports/${checksum}.${item.file_format}`;
  const contentType = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }[item.file_format];
  if (!contentType) throw new Error("Unsupported source format.");
  // Deterministic paths permit safe retries after interrupted uploads; never replace source bytes.
  const upload = await db.storage
    .from("document-templates")
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message))
    throw new Error("Private source upload failed.");
  const record = await db
    .from("document_templates")
    .insert({
      firm_id: firm.id,
      name: item.name,
      description: item.description,
      category: item.category,
      subsection: item.subsection,
      sort_order: index,
      placeholder_fields: (item.fields || []).map((f) => f.key),
      storage_path: storagePath,
      file_format: item.file_format,
      source_checksum: checksum,
      field_schema: item.fields || [],
      review_status: "needs_review",
      review_note:
        item.review_note || "Review source content and map fields before use.",
    });
  if (record.error)
    throw new Error(
      "Template registration failed. Rerun after resolving the database error; uploaded source bytes have been retained privately.",
    );
  imported++;
}
console.log(
  JSON.stringify({
    project: expectedProject,
    imported,
    skipped,
    review_required: true,
  }),
);
