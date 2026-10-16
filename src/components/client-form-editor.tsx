"use client";
import Link from "next/link";
import { useState } from "react";
import { ClientForm, validateAnswers } from "@/lib/client-forms";
export function ClientFormEditor({
  initial,
  canEdit,
}: {
  initial: ClientForm;
  canEdit: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [answers, setAnswers] = useState(initial.answers);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = form.status === "completed" || !canEdit;
  const answered = form.fields.filter((f) =>
    (answers[f.key] || "").trim(),
  ).length;
  async function save(complete = false) {
    setError("");
    setMessage("");
    const errors = validateAnswers(form.fields, answers, complete);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/client-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          revision: form.revision,
          complete,
          reviewed,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setForm((current) => ({ ...current, ...body, answers }));
      setMessage(
        complete
          ? "Completed and locked. Your document is ready to download."
          : "Draft saved. You can return to it from the client's forms.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page client-form-page">
      <Link href={`/templates/prepare?client=${form.client_id}`}>
        ← Back to client forms
      </Link>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            CLIENT FORM · {form.status.toUpperCase()}
          </span>
          <h1>{form.template_name}</h1>
          <p>
            {answered} of {form.fields.length} questions answered. Review
            prefilled information with the client.
          </p>
        </div>
        {form.status === "completed" && (
          <a className="primary" href={`/api/client-forms/${form.id}/export`}>
            Download completed {form.file_format.toUpperCase()}
          </a>
        )}
      </div>
      <div className="card form-completion-note">
        Answers are saved to this client and matter only. Typed names here do
        not execute a will, notarize a document, or provide a signature.
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="card client-questionnaire"
      >
        <fieldset disabled={locked || busy}>
          {Array.from(new Set(form.fields.map((f) => f.section))).map(
            (section) => (
              <section className="questionnaire-section" key={section}>
                <h2>{section}</h2>
                <div className="template-form-grid">
                  {form.fields
                    .filter((f) => f.section === section)
                    .map((field) => (
                      <label
                        key={field.key}
                        className={field.type === "textarea" ? "wide" : ""}
                      >
                        {field.label}
                        {field.required ? " *" : ""}
                        {field.prefill && (
                          <small>
                            Prefilled when available — confirm with client
                          </small>
                        )}
                        {field.type === "select" ||
                        field.type === "checkbox" ? (
                          <select
                            value={answers[field.key] || ""}
                            onChange={(event) => {
                              setAnswers((v) => ({
                                ...v,
                                [field.key]: event.target.value,
                              }));
                              setReviewed(false);
                            }}
                          >
                            <option value="">Choose an answer</option>
                            {(field.type === "checkbox"
                              ? ["Yes", "No"]
                              : field.options
                            ).map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            rows={4}
                            value={answers[field.key] || ""}
                            maxLength={20000}
                            onChange={(event) => {
                              setAnswers((v) => ({
                                ...v,
                                [field.key]: event.target.value,
                              }));
                              setReviewed(false);
                            }}
                          />
                        ) : (
                          <input
                            type={field.type === "date" ? "date" : "text"}
                            value={answers[field.key] || ""}
                            maxLength={20000}
                            onChange={(event) => {
                              setAnswers((v) => ({
                                ...v,
                                [field.key]: event.target.value,
                              }));
                              setReviewed(false);
                            }}
                          />
                        )}
                      </label>
                    ))}
                </div>
              </section>
            ),
          )}
        </fieldset>
        {!locked && (
          <>
            <label className="completion-review">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
                disabled={busy}
              />{" "}
              I reviewed every answer with the client and confirmed all required
              information is complete.
            </label>
            <div className="form-actions">
              <button className="secondary" disabled={busy}>
                Save draft
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy || !reviewed}
                onClick={() => void save(true)}
              >
                Complete and lock
              </button>
            </div>
          </>
        )}
        <p role="status">{message}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
