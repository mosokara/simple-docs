"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Copy, FilePlus2, FileText, Heart, Plus, Search, Trash2 } from "lucide-react";
import { CodeViewer } from "./code-viewer";
import { desktop } from "@/lib/desktop-api";
import type { LibraryItemKind, LibraryNote } from "@/types/library";

const LANGUAGE_EXTENSIONS: Record<string, string> = { javascript: "js", typescript: "ts", jsx: "jsx", tsx: "tsx", python: "py", html: "html", css: "css", sql: "sql", bash: "sh", json: "json", text: "txt" };

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
}).format(new Date(value));

export function NotesWorkspace() {
  const [items, setItems] = useState<LibraryNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "note" | "snippet" | "favorites">("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<LibraryItemKind>("note");
  const [language, setLanguage] = useState("javascript");
  const [snippetPreview, setSnippetPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function refresh(preferredId?: string | null, searchText = query, selectedFilter = filter, syncEditor = true) {
    const next = await desktop.listLibraryItems({
      query: searchText,
      kind: selectedFilter === "favorites" ? "all" : selectedFilter,
      favoritesOnly: selectedFilter === "favorites",
    });
    setItems(next);
    const target = preferredId ?? selectedId;
    const current = next.find((item) => item.id === target) ?? next[0] ?? null;
    if (syncEditor) {
      setSelectedId(current?.id ?? null);
      if (current) {
        setTitle(current.title);
        setContent(current.content);
        setKind(current.kind);
        setLanguage(current.language ?? "javascript");
        setDirty(false);
      } else if (!target) {
        setTitle("");
        setContent("");
        setDirty(false);
      }
    }
  }

  useEffect(() => {
    void refresh(null).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load the Library."));
  // Initial load only; refresh is intentionally controlled by user actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectItem(item: LibraryNote) {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    const opened = await desktop.openLibraryItem(item.id);
    setSelectedId(item.id);
    setTitle(opened.title);
    setContent(opened.content);
    setKind(opened.kind);
    setLanguage(opened.language ?? "javascript");
    setDirty(false);
    setMessage("");
  }

  function startNew(nextKind: LibraryItemKind) {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setSelectedId(null);
    setTitle(nextKind === "snippet" ? "Untitled snippet" : "Untitled note");
    setContent("");
    setKind(nextKind);
    setLanguage("javascript");
    setDirty(true);
    setMessage("");
  }

  async function save() {
    if (!title.trim()) {
      setMessage("Add a title before saving.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const saved = await desktop.saveLibraryItem({
        id: selectedId ?? undefined,
        title,
        content,
        kind,
        language: kind === "snippet" ? language : null,
      });
      await refresh(saved.id);
      setMessage("Saved locally");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this item.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {\n    try {\n      await navigator.clipboard.writeText(content);\n      setMessage("Copied to clipboard");\n    } catch {\n      setMessage("Clipboard access was denied.");\n    }\n  }\n\n  async function remove() {
    if (!selectedId || !window.confirm("Delete this item permanently?")) return;
    await desktop.deleteLibraryItem(selectedId);
    setSelectedId(null);
    setTitle("");
    setContent("");
    setDirty(false);
    await refresh(null);
  }

  async function toggleFavorite(item: LibraryNote) {
    await desktop.setLibraryFavorite(item.id, !item.favorite);
    await refresh(item.id);
  }

  const visibleItems = items;

  return (
    <section className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-bg-alt">
        <div className="border-b border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Your library</h2>
              <p className="mt-0.5 text-xs text-muted">Stored on this device</p>
            </div>
            <button onClick={() => startNew("note")} className="rounded-md p-2 text-muted hover:bg-hover hover:text-text" title="New note">
              <Plus size={17} />
            </button>
          </div>
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { if (dirty && !window.confirm("Discard your unsaved changes?")) return; setDirty(false); void refresh(null); } }} placeholder="Search your library" className="h-9 w-full border border-border bg-bg pl-9 pr-3 text-xs outline-none focus:border-brand" />
          </label>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {(["all", "note", "snippet", "favorites"] as const).map((value) => (
            <button key={value} onClick={() => { if (dirty && !window.confirm("Discard your unsaved changes?")) return; setDirty(false); setFilter(value); void refresh(null, query, value); }} className={"whitespace-nowrap rounded px-2 py-1.5 text-[11px] capitalize " + (filter === value ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-hover")}>
              {value}
            </button>
          ))}
        </div>
        <div className="docs-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {visibleItems.length ? visibleItems.map((item) => (
            <div key={item.id} className={"group mb-1 flex items-center gap-1 rounded-md " + (selectedId === item.id ? "bg-hover" : "hover:bg-hover")}>
              <button onClick={() => void selectItem(item)} className="flex min-w-0 flex-1 items-start gap-2 px-2 py-2 text-left">
                {item.kind === "snippet" ? <Code2 size={15} className="mt-0.5 shrink-0 text-brand" /> : <FileText size={15} className="mt-0.5 shrink-0 text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-text">{item.title}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted">{item.kind === "snippet" ? item.language : "Note"} · {dateLabel(item.updatedAt)}</span>
                </span>
              </button>
              <button onClick={() => void toggleFavorite(item)} className="mr-1 rounded p-1.5 text-muted opacity-0 hover:text-brand group-hover:opacity-100" aria-label={item.favorite ? "Remove favorite" : "Add favorite"}>
                <Heart size={13} fill={item.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          )) : <p className="p-3 text-xs leading-5 text-muted">No items yet. Create a note or save a code snippet.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
          <button onClick={() => startNew("note")} className="flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs text-soft hover:bg-hover"><FilePlus2 size={14} /> Note</button>
          <button onClick={() => startNew("snippet")} className="flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs text-soft hover:bg-hover"><Code2 size={14} /> Snippet</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        {selectedId || dirty ? (
          <>
            <div className="flex min-h-14 items-center gap-3 border-b border-border px-5">
              <div className="min-w-0 flex-1">
                <input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="Untitled" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted" />
              </div>
              {kind === "snippet" && (
                <>
                  <select value={language} onChange={(event) => { setLanguage(event.target.value); setDirty(true); }} className="h-8 border border-border bg-bg px-2 text-xs text-soft outline-none"><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="jsx">JSX</option><option value="tsx">TSX</option><option value="python">Python</option><option value="html">HTML</option><option value="css">CSS</option><option value="sql">SQL</option><option value="bash">Bash</option><option value="json">JSON</option><option value="text">Plain text</option></select>
                  <button onClick={() => void copyCode()} className="rounded-md p-2 text-muted hover:bg-hover hover:text-text" title="Copy code"><Copy size={15} /></button>
                </>
              )}
              <button onClick={() => void save()} disabled={!dirty || busy} className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
              {selectedId && <button onClick={() => void remove()} className="rounded-md p-2 text-muted hover:bg-hover hover:text-error" title="Delete item"><Trash2 size={15} /></button>}
            </div>
            {kind === "snippet" ? (
              <div className="flex min-h-0 flex-1 flex-col p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] text-muted">CODE SNIPPET · {language.toUpperCase()}</div>
                  <div className="flex gap-1 rounded-md border border-border p-1">
                    <button onClick={() => setSnippetPreview(false)} className={"rounded px-2.5 py-1 text-[11px] " + (!snippetPreview ? "bg-hover text-text" : "text-muted")}>Edit</button>
                    <button onClick={() => setSnippetPreview(true)} className={"rounded px-2.5 py-1 text-[11px] " + (snippetPreview ? "bg-hover text-text" : "text-muted")}>Preview</button>
                  </div>
                </div>
                {snippetPreview ? (
                  <div className="docs-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-code-bg p-4">
                    <CodeViewer code={content} fileName={"snippet." + (LANGUAGE_EXTENSIONS[language] ?? "txt")} />
                  </div>
                ) : (
                  <textarea value={content} onChange={(event) => { setContent(event.target.value); setDirty(true); }} spellCheck={false} className="docs-scroll min-h-0 flex-1 resize-none rounded-lg border border-border bg-code-bg p-4 font-mono text-[13px] leading-6 text-code-foreground outline-none focus:border-brand" placeholder="// Paste or write your code here…" />
                )}
              </div>
            ) : (
              <textarea value={content} onChange={(event) => { setContent(event.target.value); setDirty(true); }} className="docs-scroll min-h-0 flex-1 resize-none bg-transparent p-6 text-sm leading-7 text-soft outline-none" placeholder="Start writing your note…" />
            )}
            <div className="flex h-9 shrink-0 items-center justify-between border-t border-border px-5 text-[11px] text-muted">
              <span>{message || (dirty ? "Unsaved changes" : selected?.updatedAt ? "All changes saved" : "New item")}</span>
              <span>{content.length.toLocaleString()} characters</span>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-2xl border border-border bg-bg-alt p-4 text-brand"><FileText size={26} /></div>
            <h2 className="text-base font-semibold">Your ideas, in one place.</h2>
            <p className="max-w-sm text-sm leading-6 text-muted">Create notes for what matters and keep reusable code close at hand. Everything stays on this device.</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => startNew("note")} className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-xs font-semibold text-black"><FilePlus2 size={15} /> New note</button>
              <button onClick={() => startNew("snippet")} className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-xs text-soft hover:bg-hover"><Code2 size={15} /> New snippet</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
