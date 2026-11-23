"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SearchResponse } from "@/lib/search";

export function GlobalSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signInRequired, setSignInRequired] = useState(false);

  useEffect(() => {
    if (open && !dialog.current?.open) { dialog.current?.showModal(); searchInput.current?.focus(); }
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("keydown", shortcut); activeRequest.current?.abort(); };
  }, []);

  function close() {
    activeRequest.current?.abort(); setLoading(false); setOpen(false);
    setResponse(null); setError(""); setSignInRequired(false); setCategory("all");
  }
  function changeQuery(value: string) {
    activeRequest.current?.abort(); setLoading(false); setQuery(value);
    setResponse(null); setError(""); setSignInRequired(false);
  }
  async function runSearch(nextCategory = category, page = 0) {
    setOpen(true);
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    setCategory(nextCategory); setResponse(null); setError(""); setSignInRequired(false);
    if (query.trim().length < 2) { setError("Enter at least two characters."); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ q: query.trim(), category: nextCategory, page }), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.redirected || result.status === 401 || result.status === 403) {
        setSignInRequired(true); throw new Error("Sign in with an active staff account to search these records.");
      }
      const body = await result.json().catch(() => ({ error: "Search is temporarily unavailable. Please try again." }));
      if (!result.ok) throw new Error(body.error || "Unable to search. Please try again.");
      if (!controller.signal.aborted) setResponse(body);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to search. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void runSearch(); }
  const categories = response?.categories || [];
  const found = response?.groups.reduce((count, group) => count + group.results.length, 0) || 0;

  return <>
    <form className="global-search-box" role="search" onSubmit={submit}>
      <Search size={16} aria-hidden="true"/>
      <input aria-label="Search all firm records" placeholder="Search all firm records…" value={query} maxLength={120} onChange={(event) => changeQuery(event.target.value)}/>
      <button type="submit" aria-label="Search firm records">Search</button>
    </form>
    <dialog className="global-search-dialog" ref={dialog} onCancel={(event) => { event.preventDefault(); close(); }}>
      <div className="global-search-panel">
        <div className="global-search-heading"><div><span className="eyebrow">STAFF WORKSPACE</span><h2>Search firm records</h2><p>Search names, contact details, notes, matter numbers, dates, and document names.</p></div>
          <button className="secondary" type="button" onClick={close} aria-label="Close search"><X size={18}/></button></div>
        <form className="global-search-form" role="search" onSubmit={submit}>
          <label><span className="sr-only">Search term</span><input ref={searchInput} value={query} placeholder="What are you looking for?" aria-label="Search term" maxLength={120} onChange={(event) => changeQuery(event.target.value)}/></label>
          <button className="primary" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
        </form>
        {response && <label className="global-search-category">Search in<select aria-label="Search category" value={category} onChange={(event) => void runSearch(event.target.value)}>
          <option value="all">All records</option>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>}
        {loading && <p className="global-search-status" role="status">Searching your authorized firm records…</p>}
        {error && <div className="error" role="alert">{error}{signInRequired && <p><Link href="/login" onClick={close}>Staff sign-in</Link></p>}</div>}
        {response?.partial && <p className="error" role="status">Some records could not be searched: {response.unavailable.join(", ")}. Try again to include them.</p>}
        {response && <div className="global-search-results" aria-live="polite">
          {!found && <p className="global-search-status">{response.page > 0 ? "No more matches in this category." : "No matching records. Try a name, phone number, matter number, or another search term."}</p>}
          {response.groups.filter((group) => group.results.length || group.hasMore).map((group) => <section className="global-search-group" key={group.key}>
            <div className="global-search-group-heading"><h3>{group.label}</h3><span>{group.results.length} shown</span></div>
            {group.results.map((item) => <Link className="global-search-result" key={item.id} href={item.href} onClick={close}>
              <strong>{item.title}</strong>{item.detail && <span>{item.detail}</span>}{item.snippet && <small>{item.snippet}</small>}
              <em>Open record →</em>
            </Link>)}
            {category === "all" && group.hasMore && <button type="button" className="secondary" onClick={() => void runSearch(group.key)}>View more matches</button>}
          </section>)}
          {category !== "all" && <div className="global-search-pagination">
            <button type="button" className="secondary" disabled={response.page === 0 || loading} onClick={() => void runSearch(category, response.page - 1)}>Previous</button>
            <span>Page {response.page + 1}</span><button type="button" className="secondary" disabled={!response.groups.some((group) => group.hasMore) || loading} onClick={() => void runSearch(category, response.page + 1)}>Next</button>
          </div>}
        </div>}
        {!response && !loading && !error && <p className="global-search-status">Enter at least two characters and press Search. Only records available to your account will appear.</p>}
        <p className="global-search-footnote">File names and stored document details are searchable. Text inside uploaded files is not indexed.</p>
      </div>
    </dialog>
  </>;
}
