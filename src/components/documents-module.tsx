"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileUp, Image as ImageIcon, LockKeyhole, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { caseFileAccept, caseFileBucket, maxStaffFiles, staffStoragePath, validateCaseFile } from "@/lib/file-uploads";

type Choice = { id: string; name: string };
type DocumentRow = {
  id: string; name: string; storage_path: string | null; document_type: string | null;
  status: string; owner_name: string | null; client_id: string | null; matter_id: string | null;
  file_size: number | null; created_at: string;
};

export function DocumentsModule({ initial, clients, matters, firmId, profileId, ownerName }: {
  initial: DocumentRow[]; clients: Choice[]; matters: Choice[]; firmId: string; profileId: string; ownerName: string;
}) {
  const [rows, setRows] = useState(initial);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const paths = rows.filter((row) => row.storage_path && links[row.id] === undefined);
    if (!paths.length) return;
    let active = true;
    Promise.all(paths.map(async (row) => {
      const signed = await supabase.storage.from(caseFileBucket).createSignedUrl(row.storage_path!, 60 * 60);
      return [row.id, signed.data?.signedUrl || ""] as const;
    })).then((entries) => {
      if (active) setLinks((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [links, rows, supabase]);

  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [query, rows]);

  async function upload(formData: FormData) {
    setUploading(true);
    setError("");
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length || files.length > maxStaffFiles) {
      setError(`Choose between 1 and ${maxStaffFiles} files.`);
      setUploading(false);
      return;
    }
    const invalid = files.map(validateCaseFile).find(Boolean);
    if (invalid) {
      setError(invalid);
      setUploading(false);
      return;
    }
    const clientId = String(formData.get("clientId") || "") || null;
    const matterId = String(formData.get("matterId") || "") || null;
    const paths = files.map((file) => staffStoragePath(firmId, file));
    const uploaded: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const stored = await supabase.storage.from(caseFileBucket).upload(paths[index], files[index], {
        contentType: files[index].type, cacheControl: "3600", upsert: false,
      });
      if (stored.error) {
        if (uploaded.length) await supabase.storage.from(caseFileBucket).remove(uploaded);
        setError(stored.error.message);
        setUploading(false);
        return;
      }
      uploaded.push(paths[index]);
    }
    const records = files.map((file, index) => ({
        firm_id: firmId, client_id: clientId, matter_id: matterId, uploaded_by: profileId,
        name: file.name, storage_path: paths[index],
        document_type: file.type.startsWith("image/") ? "Photo" : "Document",
        mime_type: file.type, file_size: file.size, status: "Filed", owner_name: ownerName,
    }));
    const created = await supabase.from("documents").insert(records)
      .select("id,name,storage_path,document_type,status,owner_name,client_id,matter_id,file_size,created_at");
    if (created.error || !created.data) {
      await supabase.storage.from(caseFileBucket).remove(paths);
      setError(created.error?.message || "Unable to save the file records.");
      setUploading(false);
      return;
    }
    setRows((current) => [...created.data.reverse(), ...current]);
    setOpen(false);
    setUploading(false);
  }

  const clientNames = Object.fromEntries(clients.map((client) => [client.id, client.name]));
  const matterNames = Object.fromEntries(matters.map((matter) => [matter.id, matter.name]));

  return <section className="page">
    <div className="page-head"><div><span className="eyebrow">SECURE FILES</span><h1>Documents</h1><p>Pictures and documents stored in private, firm-scoped storage.</p></div><button className="primary" onClick={() => setOpen(true)}><FileUp size={16}/> Upload files</button></div>
    <div className="file-security-note"><LockKeyhole size={16}/><span>Files are private. Access links expire after one hour and can only be created by authorized Pride Law staff.</span></div>
    <div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files…"/><span>{filtered.length} files</span></div>
    <div className="document-grid">{filtered.map((row) => <article className="card document-card" key={row.id}>
      <div className="document-icon">{row.document_type?.toLowerCase().includes("photo") ? <ImageIcon/> : <FileUp/>}</div>
      <div><h2>{row.name}</h2><p>{row.document_type || "Document"} · {formatBytes(row.file_size)}</p></div>
      <dl><div><dt>Linked to</dt><dd>{row.client_id ? clientNames[row.client_id] : row.matter_id ? matterNames[row.matter_id] : "General firm file"}</dd></div><div><dt>Uploaded by</dt><dd>{row.owner_name || "Pride Law"}</dd></div></dl>
      {row.storage_path && links[row.id] ? <a className="secondary file-open-link" href={links[row.id]} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open securely</a> : <span className="file-link-loading">Preparing secure link…</span>}
    </article>)}</div>
    {!filtered.length && <div className="card empty-state"><h2>No files found</h2><p>Upload a photo, PDF, Word document, spreadsheet, or text file.</p></div>}
    {open && <div className="modal" role="dialog" aria-modal="true"><form action={upload} className="modal-card file-upload-modal">
      <div className="modal-title"><div><span className="eyebrow">PRIVATE STORAGE</span><h2>Upload files</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={18}/></button></div>
      {error && <div className="error" role="alert">{error}</div>}
      <label>Pictures or documents<input name="files" type="file" accept={caseFileAccept} multiple required/><small>Up to 10 files, 10 MB each.</small></label>
      <label>Client (optional)<select name="clientId"><option value="">General firm file</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Matter (optional)<select name="matterId"><option value="">No matter selected</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.name}</option>)}</select></label>
      <div><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={uploading}>{uploading ? "Uploading securely…" : "Upload"}</button></div>
    </form></div>}
  </section>;
}

function formatBytes(value: number | null) {
  if (!value) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
