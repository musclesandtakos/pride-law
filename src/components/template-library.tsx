"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  placeholder_fields: string[];
  updated_at: string;
};

export function TemplateLibrary({ initial, canManage }: { initial: Template[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(initial.map((template) => template.category))).sort()],
    [initial],
  );

  const filtered = useMemo(
    () =>
      initial.filter((template) => {
        if (category !== "All" && template.category !== category) return false;
        const text = `${template.name} ${template.description || ""} ${template.placeholder_fields.join(" ")}`.toLowerCase();
        return text.includes(query.toLowerCase());
      }),
    [initial, query, category],
  );

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">DOCUMENT TEMPLATES</span>
          <h1>Template library</h1>
          <p>Choose a template, then personalize it with your client information.</p>
        </div>
        {canManage && (
          <Link className="primary" href="/templates/admin">
            Manage templates
          </Link>
        )}
      </div>
      <div className="template-filters card">
        <label>
          Search templates
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or field" />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="template-grid">
        {filtered.map((template) => (
          <article key={template.id} className="card template-card">
            <div className="template-card-head">
              <span className="pill">{template.category}</span>
              <small>Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(template.updated_at))}</small>
            </div>
            <h2>{template.name}</h2>
            <p>{template.description || "No description provided."}</p>
            <div className="template-tags">
              {template.placeholder_fields.length ? (
                template.placeholder_fields.map((field) => (
                  <span key={field} className="template-tag">
                    {field.replaceAll("_", " ")}
                  </span>
                ))
              ) : (
                <span className="template-tag">No custom fields</span>
              )}
            </div>
            <Link className="secondary" href={`/templates/${template.id}/edit`}>
              Use template
            </Link>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="card empty-state">
          <h2>No templates found</h2>
          <p>Try another search or ask an administrator to upload a new .docx template.</p>
        </div>
      )}
    </section>
  );
}
