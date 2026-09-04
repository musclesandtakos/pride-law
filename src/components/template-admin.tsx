"use client";

import { useState } from "react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  placeholder_fields: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function TemplateAdmin({ initial }: { initial: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(formData: FormData) {
    setUploading(true);
    setError("");
    const response = await fetch("/api/templates", { method: "POST", body: formData });
    const body = await response.json();
    setUploading(false);

    if (!response.ok) {
      setError(body.error || "Unable to upload template");
      return;
    }

    setTemplates((value) => [body, ...value].sort((a, b) => a.sort_order - b.sort_order));
    const form = document.getElementById("template-upload-form") as HTMLFormElement | null;
    form?.reset();
  }

  async function saveTemplate(id: string, payload: Record<string, unknown>) {
    setSaving(id);
    setError("");
    const response = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setSaving(null);

    if (!response.ok) {
      setError(body.error || "Unable to update template");
      return;
    }

    setTemplates((value) =>
      value
        .map((template) => (template.id === id ? body : template))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    );
  }

  async function removeTemplate(id: string) {
    setSaving(id);
    setError("");
    const response = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    const body = await response.json();
    setSaving(null);

    if (!response.ok) {
      setError(body.error || "Unable to delete template");
      return;
    }

    if (body.deleted) setTemplates((value) => value.filter((template) => template.id !== id));
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">ADMIN TOOLS</span>
          <h1>Template manager</h1>
          <p>Upload, organize, and retire .docx templates for the firm.</p>
        </div>
      </div>
      <form id="template-upload-form" action={upload} className="card template-upload-form">
        <h2>Upload template</h2>
        <div className="template-form-grid">
          <label>
            Template file (.docx)
            <input type="file" name="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
          </label>
          <label>
            Display name
            <input name="name" placeholder="Engagement Letter" />
          </label>
          <label>
            Category
            <input name="category" placeholder="Family Law" />
          </label>
          <label>
            Sort order
            <input name="sortOrder" type="number" defaultValue={0} min={0} />
          </label>
          <label className="wide">
            Placeholder fields (comma separated)
            <input name="placeholderFields" placeholder="client_name, matter_number, hearing_date" />
          </label>
          <label className="wide">
            Description
            <input name="description" placeholder="Template for new retained matters" />
          </label>
        </div>
        <div className="template-form-actions">
          <button className="primary" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload template"}
          </button>
        </div>
      </form>
      {error && <div className="error page-error">{error}</div>}
      <div className="template-grid admin-grid">
        {templates.map((template) => (
          <TemplateAdminCard
            key={template.id}
            template={template}
            busy={saving === template.id}
            onSave={saveTemplate}
            onDelete={removeTemplate}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateAdminCard({
  template,
  busy,
  onSave,
  onDelete,
}: {
  template: Template;
  busy: boolean;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [category, setCategory] = useState(template.category);
  const [sortOrder, setSortOrder] = useState(String(template.sort_order));
  const [placeholderFields, setPlaceholderFields] = useState(template.placeholder_fields.join(", "));

  return (
    <article className="card template-card admin-card">
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Category
        <input value={category} onChange={(event) => setCategory(event.target.value)} />
      </label>
      <label>
        Sort order
        <input value={sortOrder} type="number" min={0} onChange={(event) => setSortOrder(event.target.value)} />
      </label>
      <label>
        Placeholder fields
        <input value={placeholderFields} onChange={(event) => setPlaceholderFields(event.target.value)} />
      </label>
      <label>
        Description
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="template-card-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            onSave(template.id, {
              name,
              description,
              category,
              sortOrder: Number(sortOrder || 0),
              placeholderFields,
            })
          }
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="secondary danger-button" disabled={busy} onClick={() => onDelete(template.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}
