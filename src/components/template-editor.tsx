"use client";

import { useMemo, useState } from "react";
import { humanizeField } from "@/lib/templates";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  placeholder_fields: string[];
};

export function TemplateEditor({
  template,
  downloadUrl,
}: {
  template: Template;
  downloadUrl: string | null;
}) {
  const [clientName, setClientName] = useState("");
  const [matterNumber, setMatterNumber] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const summary = useMemo(
    () => [
      ["Client name", clientName],
      ["Matter number", matterNumber],
      ...template.placeholder_fields.map((key) => [humanizeField(key), fields[key] || ""] as [string, string]),
      ["Personalization notes", customNotes],
    ],
    [clientName, matterNumber, customNotes, fields, template.placeholder_fields],
  );

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">TEMPLATE PERSONALIZATION</span>
          <h1>{template.name}</h1>
          <p>{template.description || "Fill in client details, then apply them while editing the downloaded document."}</p>
        </div>
        {downloadUrl && (
          <a className="primary" href={downloadUrl} target="_blank" rel="noreferrer">
            Download .docx
          </a>
        )}
      </div>
      <div className="template-editor-grid">
        <form className="card template-upload-form" onSubmit={(event) => event.preventDefault()}>
          <h2>Client details</h2>
          <div className="template-form-grid">
            <label>
              Client name
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Jordan Rivera" />
            </label>
            <label>
              Matter number
              <input value={matterNumber} onChange={(event) => setMatterNumber(event.target.value)} placeholder="PL-2026-114" />
            </label>
            {template.placeholder_fields.map((field) => (
              <label key={field} className="wide">
                {humanizeField(field)}
                <input
                  value={fields[field] || ""}
                  onChange={(event) => setFields((value) => ({ ...value, [field]: event.target.value }))}
                  placeholder={`Enter ${humanizeField(field).toLowerCase()}`}
                />
              </label>
            ))}
            <label className="wide">
              Personalization notes
              <textarea
                value={customNotes}
                onChange={(event) => setCustomNotes(event.target.value)}
                placeholder="Add specific wording or reminders for this client."
                rows={4}
              />
            </label>
          </div>
        </form>
        <article className="card template-preview">
          <h2>Prepared details</h2>
          <p>Use this summary while customizing the template document.</p>
          <dl>
            {summary.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}
