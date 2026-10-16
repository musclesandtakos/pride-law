"use client";
import Link from "next/link";
import { useState } from "react";
import { FormField, prefillKeys, formFieldSchema } from "@/lib/client-forms";
export function TemplateMapping({
  template,
  sourceUrl,
}: {
  template: {
    id: string;
    name: string;
    file_format: string;
    fields: FormField[];
    review_note: string;
    review_status: string;
  };
  sourceUrl: string | null;
}) {
  const [fields, setFields] = useState(template.fields);
  const [note, setNote] = useState(template.review_note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function update(index: number, change: Partial<FormField>) {
    setFields((v) => v.map((f, i) => (i === index ? { ...f, ...change } : f)));
  }
  async function save(ready: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/templates/${template.id}/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, ready, review_note: note }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setMessage(
        ready
          ? "Template is ready for client completion."
          : "Mapping saved for review.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save mapping.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page mapping-panel">
      <Link href="/templates/admin">← Template manager</Link>
      <div className="page-head">
        <div>
          <span className="eyebrow">ADMINISTRATOR REVIEW</span>
          <h1>{template.name}</h1>
          <p>
            Review the source, define every question, and choose where each
            answer appears.
          </p>
        </div>
        {sourceUrl && (
          <a
            className="secondary"
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open source document
          </a>
        )}
      </div>
      <section className="card client-questionnaire">
        <p>
          Confirm all prior client names, addresses, dates, beneficiaries and
          other case details have been removed. Verify current firm branding and
          document content. Signatures and notarization must be handled
          separately.
        </p>
        {template.file_format === "doc" && (
          <p>
            Convert this legacy Word source to .docx and upload the converted
            reusable template before activation.
          </p>
        )}
        {fields.map((field, index) => (
          <fieldset disabled={busy} key={index} className="mapping-row">
            <legend>Question {index + 1}</legend>
            <div className="template-form-grid">
              <label>
                Question label
                <input
                  value={field.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </label>
              <label>
                Section
                <input
                  value={field.section}
                  onChange={(e) => update(index, { section: e.target.value })}
                />
              </label>
              <label>
                Stable field key
                <input
                  value={field.key}
                  onChange={(e) => update(index, { key: e.target.value })}
                />
              </label>
              <label>
                Answer type
                <select
                  value={field.type}
                  onChange={(e) =>
                    update(index, { type: e.target.value as FormField["type"] })
                  }
                >
                  {["text", "textarea", "date", "select", "checkbox"].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Prefill from
                <select
                  value={field.prefill}
                  onChange={(e) =>
                    update(index, {
                      prefill: e.target.value as FormField["prefill"],
                    })
                  }
                >
                  {prefillKeys.map((k) => (
                    <option key={k} value={k}>
                      {k ? k.replaceAll("_", " ") : "Enter with client"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {template.file_format === "pdf"
                  ? "PDF field name (leave blank for a placement box)"
                  : "Word placeholder name without braces"}
                <input
                  value={field.target || ""}
                  onChange={(e) => update(index, { target: e.target.value })}
                />
              </label>
              {field.type === "select" && (
                <label className="wide">
                  Choices (one per line)
                  <textarea
                    value={field.options.join("\n")}
                    onChange={(e) =>
                      update(index, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              {template.file_format === "pdf" && !field.target && (
                <label className="wide">
                  Placement box: page (starting at 1), left, bottom, width,
                  height in PDF points
                  <input
                    defaultValue={
                      field.overlay
                        ? [
                            field.overlay.page + 1,
                            field.overlay.x,
                            field.overlay.y,
                            field.overlay.width,
                            field.overlay.height,
                          ].join(", ")
                        : ""
                    }
                    onBlur={(e) => {
                      const n = e.target.value.split(",").map(Number);
                      if (n.length === 5 && n.every(Number.isFinite))
                        update(index, {
                          overlay: {
                            page: n[0] - 1,
                            x: n[1],
                            y: n[2],
                            width: n[3],
                            height: n[4],
                          },
                        });
                    }}
                    placeholder="1, 60, 620, 220, 18"
                  />
                </label>
              )}
            </div>
            <div className="mapping-controls">
              <label>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    update(index, { required: e.target.checked })
                  }
                />{" "}
                Required answer
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setFields((v) => v.filter((_, i) => i !== index))
                }
              >
                Remove question
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() =>
            setFields((v) => [
              ...v,
              formFieldSchema.parse({
                key: `question_${crypto.randomUUID().slice(0, 8)}`,
                label: "New question",
              }),
            ])
          }
        >
          Add question
        </button>
        <label className="completion-review">
          Source review notes
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Confirm source content, branding, prior-client removal, and complete field mapping."
            rows={4}
          />
        </label>
        <div className="form-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            Save for review
          </button>
          <button
            className="primary"
            disabled={busy || !note.trim() || template.file_format === "doc"}
            onClick={() => void save(true)}
          >
            Approve for client use
          </button>
        </div>
        <p role="status">{message}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </section>
  );
}
