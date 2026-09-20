"use client";

import Link from "next/link";
import { MessageSquareText, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ResourceField } from "@/lib/resources";

type RecordValue = string | number | boolean | null;
type DataRow = Record<string, RecordValue>;

export function DataModule({ title, singular, resource, columns, labels, fields, initial }: {
  title: string;
  singular: string;
  resource: string;
  columns: readonly string[];
  labels: Record<string, string>;
  fields: readonly ResourceField[];
  initial: DataRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DataRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  function openCreate() {
    setEditing(null);
    setError("");
    setModalOpen(true);
  }

  function openEdit(row: DataRow) {
    setEditing(row);
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setError("");
  }

  async function save(formData: FormData) {
    setSaving(true);
    setError("");
    const isEditing = Boolean(editing?.id);
    const response = await fetch(isEditing ? `/api/resources/${resource}/${editing?.id}` : `/api/resources/${resource}`, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(body.error || `Unable to save ${singular.toLowerCase()}.`);
      return;
    }
    setRows((current) => isEditing ? current.map((row) => row.id === body.id ? body : row) : [body, ...current]);
    setModalOpen(false);
    setEditing(null);
  }

  return <section className="page">
    <div className="page-head">
      <div><span className="eyebrow">PRIDE LAW OPERATIONS</span><h1>{title}</h1><p>Authorized firm records protected by row-level security.</p></div>
      <button className="primary" onClick={openCreate}><Plus size={16}/> Add {singular.toLowerCase()}</button>
    </div>
    <div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Filter ${title.toLowerCase()}…`}/><span>{filtered.length} records</span></div>
    <div className="card table-card">
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{labels[column] || column}</th>)}<th className="record-actions-heading">Actions</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={String(row.id)}>
          {columns.map((column) => <td key={column}>{format(row[column], column)}</td>)}
          <td className="record-actions">{resource === "clients" ? <Link className="client-communications-link" href={`/clients/${row.id}`} aria-label={`Open communications for ${String(row.name || singular)}`}><MessageSquareText size={14}/> Communications</Link> : null}<button className="edit-record-button" onClick={() => openEdit(row)} aria-label={`Edit ${String(row.name || singular)}`}><Pencil size={14}/> Edit</button></td>
        </tr>)}</tbody>
      </table>
    </div>

    {modalOpen && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
      <form action={save} className="modal-card record-modal-card">
        <div className="modal-title"><div><span className="eyebrow">{editing ? "UPDATE RECORD" : "NEW RECORD"}</span><h2 id="record-modal-title">{editing ? `Edit ${singular}` : `Add ${singular}`}</h2></div><button type="button" className="icon-button" onClick={closeModal} aria-label="Close"><X size={19}/></button></div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="record-form-grid">{fields.map((field) => <RecordField key={field.name} field={field} value={editing?.[field.name]}/>)}</div>
        <div><button type="button" className="secondary" onClick={closeModal}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : `Add ${singular.toLowerCase()}`}</button></div>
      </form>
    </div>}
  </section>;
}

function RecordField({ field, value }: { field: ResourceField; value: RecordValue | undefined }) {
  const currentValue = value === null || value === undefined ? field.defaultValue || "" : String(value);
  const className = field.type === "textarea" ? "wide" : undefined;
  return <label className={className}>{field.label}
    {field.type === "select" ? <select name={field.name} defaultValue={currentValue} required={field.required}>
      {!field.required && !field.defaultValue ? <option value="">Not specified</option> : null}
      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
    </select> : field.type === "textarea" ? <textarea name={field.name} defaultValue={currentValue} rows={3}/>
      : <input name={field.name} type={field.type || "text"} defaultValue={currentValue} required={field.required}/>}
  </label>;
}

function format(value: RecordValue, key: string) {
  if (value === null || value === "") return "—";
  if (["amount", "balance", "rate"].includes(key)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
