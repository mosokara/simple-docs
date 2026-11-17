"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Code2, Copy, FileText, Folder, FolderPlus, Heart, ChevronRight, ChevronDown,
  Plus, Search, Pencil, Eye, Trash2, MoreHorizontal, FilePlus2, Clock3, Star, X,
} from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { CodeViewer } from "./code-viewer";
import { desktop } from "@/lib/desktop-api";
import type { LibraryFolder, LibraryItemKind, LibraryNote } from "@/types/library";

const MIN_WIDTH = 220;
const MAX_WIDTH = 440;
const DEFAULT_WIDTH = 288;
const EXTENSIONS: Record<string, string> = {
  javascript: "js", typescript: "ts", jsx: "jsx", tsx: "tsx", python: "py",
  html: "html", css: "css", sql: "sql", bash: "sh", json: "json", text: "txt",
};
type ActiveView = { type: "recent" | "favorites" | "folder"; folderId?: string | null };
type MenuState = { x: number; y: number; target: { type: "folder"; id: string } | { type: "item"; id: string } } | null;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function NotesWorkspace({
  query,
  mobileOpen,
  onCloseMobile,
}: {
  query: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [items, setItems] = useState<LibraryNote[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>({ type: "recent" });
  const [expanded, setExpanded] = useState<string[]>([]);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<LibraryItemKind>("note");
  const [language, setLanguage] = useState("javascript");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState<MenuState>(null);
  const [folderEditor, setFolderEditor] = useState<{ id?: string; parentId?: string | null; name: string } | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cancelTitleEditRef = useRef(false);
  const resizeRef = useRef<{ x: number; width: number } | null>(null);
  const activeFolder = activeView.type === "folder" ? folders.find((folder) => folder.id === activeView.folderId) ?? null : null;
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  async function loadFolders() {
    setFolders(await desktop.listFolders());
  }

  async function loadItems(options?: { keepSelection?: boolean }) {
    const opts = query.trim()
      ? { query: query.trim() }
      : activeView.type === "favorites"
        ? { favoritesOnly: true }
        : activeView.type === "folder"
          ? { folderId: activeView.folderId ?? null }
          : { recentOnly: true };
    const next = await desktop.listLibraryItems(opts);
    setItems(next);
    if (!options?.keepSelection && selectedId && !next.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([desktop.listLibraryItems({ recentOnly: true }), desktop.listFolders()])
      .then(([nextItems, nextFolders]) => {
        if (!active) return;
        setItems(nextItems);
        setFolders(nextFolders);
      })
      .catch((error) => active && setMessage(error instanceof Error ? error.message : "Could not load the Library."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems({ keepSelection: true }).catch((error) => setMessage(error instanceof Error ? error.message : "Search failed."));
    }, 120);
    return () => window.clearTimeout(timer);
  // Query and view changes intentionally reload the list without replacing the open editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeView.type, activeView.folderId]);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const saved = Number(localStorage.getItem("simple-docs-sidebar-width"));
      if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
        timer = window.setTimeout(() => setWidth(saved), 0);
      }
    } catch {}
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!resizeRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.width + event.clientX - resizeRef.current.x));
      setWidth(next);
    }
    function onUp() {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem("simple-docs-sidebar-width", String(width)); } catch {}
    }
    function closeMenu() { setMenu(null); }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenu(null); setFolderEditor(null); }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [width]);

  useEffect(() => {
    if (!editingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editingTitle]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function onSaveShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onSaveShortcut);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onSaveShortcut);
    };
  // save is intentionally called from the global shortcut without rebinding the listener on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, content, kind, language, selectedId, folderId, busy]);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    resizeRef.current = { x: event.clientX, width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function openMenu(event: React.MouseEvent, target: NonNullable<MenuState>["target"]) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 220;
    const menuHeight = target.type === "folder" ? 248 : 142;
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
      target,
    });
  }

  async function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  async function selectItem(item: LibraryNote) {
    if (!await confirmDiscard()) return;
    try {
      const opened = await desktop.openLibraryItem(item.id);
      setSelectedId(opened.id);
      setTitle(opened.title);
      setContent(opened.content);
      setKind(opened.kind);
      setLanguage(opened.language ?? "javascript");
      setFolderId(opened.folderId);
      setEditing(false);
      setDirty(false);
      setMessage("");
      onCloseMobile();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open this item.");
    }
  }

  async function startNew(nextKind: LibraryItemKind, targetFolderId = activeView.type === "folder" ? activeView.folderId ?? null : null) {
    if (!await confirmDiscard()) return;
    setSelectedId(null);
    setTitle(nextKind === "snippet" ? "Untitled Code" : "Untitled Note");
    setContent("");
    setKind(nextKind);
    setLanguage("javascript");
    setFolderId(targetFolderId);
    setEditing(true);
    setDirty(true);
    setMessage("");
    onCloseMobile();
  }

  async function save() {
    if (busy || !dirty) return;
    if (!title.trim()) { setMessage("A title is required."); return; }
    setBusy(true);
    setMessage("");
    try {
      const saved = await desktop.saveLibraryItem({
        id: selectedId ?? undefined,
        title,
        content,
        kind,
        language: kind === "snippet" ? language : null,
        folderId,
      });
      setSelectedId(saved.id);
      setTitle(saved.title);
      setDirty(false);
      setEditing(false);
      setEditingTitle(false);
      setMessage("All changes saved");
      await loadItems({ keepSelection: true });
      await loadFolders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    let item: LibraryNote;
    try { item = await desktop.openLibraryItem(id); }
    catch { setMessage("This item no longer exists."); return; }
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;
    await desktop.deleteLibraryItem(id);
    if (selectedId === id) {
      setSelectedId(null); setTitle(""); setContent(""); setDirty(false);
    }
    setMenu(null);
    await loadItems();
  }

  async function toggleFavorite(item: LibraryNote) {
    await desktop.setLibraryFavorite(item.id, !item.favorite);
    await loadItems({ keepSelection: true });
  }

  function startFolderEditor(folder?: LibraryFolder, parentId: string | null = null) {
    setMenu(null);
    setFolderEditor(folder ? { id: folder.id, name: folder.name } : { parentId, name: "" });
    setFolderNameDraft(folder?.name ?? "");
  }

  async function submitFolder(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (folderEditor?.id) await desktop.renameFolder(folderEditor.id, folderNameDraft);
      else {
        const created = await desktop.createFolder(folderNameDraft, folderEditor?.parentId ?? null);
        if (created.parentId) setExpanded((current) => current.includes(created.parentId!) ? current : [...current, created.parentId!]);
      }
      setFolderEditor(null);
      await loadFolders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save folder.");
    }
  }

  async function deleteFolder(id: string) {
    const folder = folders.find((entry) => entry.id === id);
    if (!folder || !window.confirm(`Delete folder "${folder.name}"? Only empty folders can be deleted.`)) return;
    try {
      await desktop.deleteFolder(id);
      if (activeView.type === "folder" && activeView.folderId === id) setActiveView({ type: "recent" });
      await loadFolders();
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete folder.");
    }
    setMenu(null);
  }

  async function commitTitle() {
    if (cancelTitleEditRef.current) {
      cancelTitleEditRef.current = false;
      setEditingTitle(false);
      return;
    }
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle) {
      setTitleDraft(title);
      return;
    }
    if (nextTitle === title) return;
    setTitle(nextTitle);
    if (!selectedId) {
      setDirty(true);
      return;
    }
    setDirty(true);
    setBusy(true);
    try {
      const saved = await desktop.saveLibraryItem({
        id: selectedId,
        title: nextTitle,
        content,
        kind,
        language: kind === "snippet" ? language : null,
        folderId,
      });
      setTitle(saved.title);
      setDirty(false);
      setMessage("Title saved");
      await loadItems({ keepSelection: true });
    } catch (error) {
      setDirty(true);
      setMessage(error instanceof Error ? error.message : "Could not rename this item.");
    } finally {
      setBusy(false);
    }
  }

  const markdownHtml = mounted ? DOMPurify.sanitize(marked.parse(content) as string) : "";
  const filteredItems = items;
  const folderChildren = (parentId: string | null) => folders.filter((folder) => folder.parentId === parentId);
  const itemsInFolder = (id: string | null) => items.filter((item) => item.folderId === id);

  function renderFolder(folder: LibraryFolder, depth = 0): React.ReactNode {
    const isExpanded = expanded.includes(folder.id);
    const isActive = activeView.type === "folder" && activeView.folderId === folder.id;
    const children = folderChildren(folder.id);
    const docs = itemsInFolder(folder.id);
    return (
      <div key={folder.id} className="select-none">
        <div
          onContextMenu={(event) => openMenu(event, { type: "folder", id: folder.id })}
          className={"group flex items-center gap-1 rounded-md pr-1 " + (isActive ? "bg-hover" : "hover:bg-hover")}
          style={{ paddingLeft: 8 + depth * 15 }}
        >
          <button onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== folder.id) : [...current, folder.id])} className="rounded p-1 text-muted hover:text-text" aria-label={isExpanded ? "Collapse folder" : "Expand folder"}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button onClick={async () => { if (!await confirmDiscard()) return; setDirty(false); setActiveView({ type: "folder", folderId: folder.id }); setSelectedId(null); }} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
            <Folder size={15} className="shrink-0 text-brand" />
            <span className="truncate text-xs text-soft">{folder.name}</span>
            <span className="ml-auto text-[10px] text-muted">{docs.length}</span>
          </button>
          <button onClick={(event) => openMenu(event, { type: "folder", id: folder.id })} className="rounded p-1 text-muted opacity-0 hover:text-text group-hover:opacity-100" title="Folder actions"><MoreHorizontal size={14} /></button>
        </div>
        {isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
            {docs.map((item) => renderItem(item, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderItem(item: LibraryNote, depth = 0) {
    return (
      <div key={item.id} onContextMenu={(event) => openMenu(event, { type: "item", id: item.id })} className={"group flex items-center gap-1 rounded-md pr-1 " + (selectedId === item.id ? "bg-hover" : "hover:bg-hover")} style={{ paddingLeft: 30 + depth * 15 }}>
        <button onClick={() => void selectItem(item)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
          {item.kind === "snippet" ? <Code2 size={14} className="shrink-0 text-brand" /> : <FileText size={14} className="shrink-0 text-muted" />}
          <span className="truncate text-xs text-soft">{item.title}</span>
        </button>
        <button onClick={() => void toggleFavorite(item)} className="rounded p-1 text-muted opacity-0 hover:text-brand group-hover:opacity-100" title={item.favorite ? "Remove favorite" : "Add favorite"}>
          <Heart size={12} fill={item.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden">
      <aside
        style={{ width }}
        className={"absolute inset-y-0 left-0 z-30 flex max-w-[calc(100vw-3rem)] shrink-0 flex-col border-r border-border bg-bg-alt transition-transform md:static md:translate-x-0 " + (mobileOpen ? "translate-x-0" : "-translate-x-full")}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border p-3">
            <button onClick={() => void startNew("note")} className="flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-bg text-xs font-medium text-soft transition-colors hover:bg-hover hover:text-text"><FilePlus2 size={14} /> Note</button>
            <button onClick={() => void startNew("snippet")} className="flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-bg text-xs font-medium text-soft transition-colors hover:bg-hover hover:text-text"><Code2 size={14} /> Code</button>
          </div>

          <div className="shrink-0 space-y-0.5 border-b border-border px-2 py-2">
            <button onClick={async () => { if (!await confirmDiscard()) return; setDirty(false); setActiveView({ type: "recent" }); setSelectedId(null); }} className={"flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs " + (activeView.type === "recent" ? "bg-hover text-text" : "text-soft hover:bg-hover")}><Clock3 size={15} /> Recent</button>
            <button onClick={async () => { if (!await confirmDiscard()) return; setDirty(false); setActiveView({ type: "favorites" }); setSelectedId(null); }} className={"flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs " + (activeView.type === "favorites" ? "bg-hover text-text" : "text-soft hover:bg-hover")}><Star size={15} /> Favorites</button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between px-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Folders</span>
              <button onClick={() => startFolderEditor(undefined, activeView.type === "folder" ? activeView.folderId ?? null : null)} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text" title="New folder"><Plus size={15} /></button>
            </div>
            <div className="docs-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {folderChildren(null).map((folder) => renderFolder(folder))}
              {itemsInFolder(null).map((item) => renderItem(item))}
              {!folders.length && !itemsInFolder(null).length && <p className="px-3 py-3 text-[11px] leading-5 text-muted">Create folders to organize notes and code by language or track.</p>}
            </div>
          </div>
        </div>
        <div onPointerDown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabIndex={0} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setWidth((value) => Math.max(MIN_WIDTH, value - 16));
          if (event.key === "ArrowRight") setWidth((value) => Math.min(MAX_WIDTH, value + 16));
        }} className="group absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize md:block">
          <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-brand/60" />
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-20 bg-black/35 md:hidden" onClick={onCloseMobile} aria-label="Close sidebar" />}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {selectedId || dirty ? (
          <>
            <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-5">
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <input ref={titleInputRef} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitle} onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); commitTitle(); }
                    if (event.key === "Escape") { setTitleDraft(title); setEditingTitle(false); }
                  }} className="w-full bg-transparent text-sm font-semibold outline-none" />
                ) : (
                  <button onDoubleClick={() => { setTitleDraft(title); setEditingTitle(true); }} className="max-w-full truncate text-left text-sm font-semibold text-text" title="Double-click to rename">{title || "Untitled"}</button>
                )}
              </div>
              {kind === "snippet" && <select value={language} onChange={(event) => { setLanguage(event.target.value); setDirty(true); }} className="h-8 max-w-32 rounded-md border border-border bg-bg px-2 text-xs text-soft outline-none focus:border-brand"><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="jsx">JSX</option><option value="tsx">TSX</option><option value="python">Python</option><option value="html">HTML</option><option value="css">CSS</option><option value="sql">SQL</option><option value="bash">Bash</option><option value="json">JSON</option><option value="text">Plain text</option></select>}
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-bg-alt p-1">
                <button onClick={() => setEditing((value) => !value)} className={"rounded-md p-2 transition-colors hover:bg-hover " + (editing ? "text-brand" : "text-muted hover:text-text")} title={editing ? "Preview" : "Edit"} aria-label={editing ? "Preview" : "Edit"}>{editing ? <Eye size={15} /> : <Pencil size={15} />}</button>
                <button onClick={() => void navigator.clipboard.writeText(content).then(() => setMessage("Copied to clipboard")).catch(() => setMessage("Clipboard access was denied."))} className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-text" title="Copy" aria-label="Copy"><Copy size={15} /></button>
                <button onClick={() => void removeItem(selectedId!)} className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-error" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-5">
              {editing ? (
                kind === "snippet" ? (
                  <textarea autoFocus value={content} onChange={(event) => { setContent(event.target.value); setDirty(true); }} spellCheck={false} className="docs-scroll h-full min-h-0 w-full resize-none rounded-lg border border-border bg-code-bg p-4 font-mono text-[13px] leading-6 text-code-foreground outline-none focus:border-brand" placeholder="// Write or paste your code here…" />
                ) : (
                  <textarea autoFocus value={content} onChange={(event) => { setContent(event.target.value); setDirty(true); }} className="docs-scroll h-full min-h-0 w-full resize-none rounded-lg border border-border bg-bg-alt p-5 text-sm leading-7 text-soft outline-none focus:border-brand" placeholder="Start writing your note…" />
                )
              ) : kind === "snippet" ? (
                <div className="docs-scroll h-full overflow-auto rounded-lg border border-border bg-code-bg p-4"><CodeViewer code={content} fileName={"snippet." + (EXTENSIONS[language] ?? "txt")} /></div>
              ) : (
                <article className="markdown docs-scroll h-full overflow-auto px-2 py-1" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
              )}
            </div>

            <div className="flex h-11 shrink-0 items-center justify-between border-t border-border px-4 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={"truncate text-[11px] " + (dirty ? "text-muted" : "text-muted")}>{message || (dirty ? "Unsaved changes" : "All changes saved")}</span>
                {dirty && <button onClick={() => void save()} disabled={busy} className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>}
              </div>
              <span className="shrink-0 text-[10px] text-muted">Ctrl + S · {content.length.toLocaleString()} chars</span>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
              <div>
                <h2 className="text-sm font-semibold">{query.trim() ? "Search results" : activeView.type === "favorites" ? "Favorites" : activeFolder?.name ?? "Recent"}</h2>
                <p className="mt-0.5 text-[11px] text-muted">{filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}</p>
              </div>
              {activeView.type === "folder" && <div className="flex gap-2"><button onClick={() => void startNew("note", activeView.folderId)} className="rounded-md border border-border px-3 py-1.5 text-xs text-soft hover:bg-hover">New Note</button><button onClick={() => void startNew("snippet", activeView.folderId)} className="rounded-md border border-border px-3 py-1.5 text-xs text-soft hover:bg-hover">New Code</button></div>}
            </div>
            <div className="docs-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
              {filteredItems.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => <button key={item.id} onClick={() => void selectItem(item)} onContextMenu={(event) => openMenu(event, { type: "item", id: item.id })} className="group rounded-lg border border-border bg-bg-alt p-4 text-left transition-colors hover:border-brand/50 hover:bg-hover">
                  <div className="flex items-center gap-2">{item.kind === "snippet" ? <Code2 size={15} className="text-brand" /> : <FileText size={15} className="text-muted" />}<span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span><button onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} className="rounded p-1 text-muted opacity-0 hover:text-brand group-hover:opacity-100" title={item.favorite ? "Remove favorite" : "Add favorite"}><Heart size={14} fill={item.favorite ? "currentColor" : "none"} /></button></div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{item.content || (item.kind === "snippet" ? "Empty code" : "Empty note")}</p>
                  <p className="mt-3 text-[10px] text-muted">{item.kind === "snippet" ? item.language : "Note"} · {formatDate(item.updatedAt)}</p>
                </button>)}
              </div> : <div className="flex h-full flex-col items-center justify-center text-center"><div className="rounded-xl border border-border bg-bg-alt p-4 text-brand"><Search size={23} /></div><h3 className="mt-4 text-sm font-semibold">{query.trim() ? "No matching items" : "Nothing here yet"}</h3><p className="mt-2 max-w-xs text-xs leading-5 text-muted">{query.trim() ? "Try another search term." : "Create a note or code file to get started."}</p>{!query.trim() && <div className="mt-4 flex gap-2"><button onClick={() => void startNew("note")} className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-black">New Note</button><button onClick={() => void startNew("snippet")} className="rounded-md border border-border px-3 py-2 text-xs text-soft hover:bg-hover">New Code</button></div>}</div>}
            </div>
          </div>
        )}
      </main>

      {folderEditor && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFolderEditor(null); }}>
        <form onSubmit={(event) => void submitFolder(event)} className="w-full max-w-sm rounded-xl border border-border bg-bg p-5 shadow-2xl">
          <h3 className="text-sm font-semibold">{folderEditor.id ? "Rename folder" : "New folder"}</h3>
          <input autoFocus value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} placeholder="Folder name" className="mt-4 h-10 w-full rounded-md border border-border bg-bg-alt px-3 text-sm outline-none focus:border-brand" />
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setFolderEditor(null)} className="rounded-md px-3 py-2 text-xs text-muted hover:bg-hover">Cancel</button><button type="submit" className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-black">Save</button></div>
        </form>
      </div>}

      {menu && <div className="fixed z-[120] min-w-[210px] rounded-lg border border-border bg-bg p-1.5 shadow-xl" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
        {menu.target.type === "folder" ? <>
          <button onClick={() => startFolderEditor(undefined, menu.target.type === "folder" ? menu.target.id : null)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><FolderPlus size={14} /> New subfolder</button>
          <button onClick={() => { const id = menu.target.type === "folder" ? menu.target.id : null; setActiveView({ type: "folder", folderId: id }); setMenu(null); void startNew("note", id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><FilePlus2 size={14} /> New Note</button>
          <button onClick={() => { const id = menu.target.type === "folder" ? menu.target.id : null; setActiveView({ type: "folder", folderId: id }); setMenu(null); void startNew("snippet", id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Code2 size={14} /> New Code</button>
          <div className="my-1 border-t border-border" />
          <button onClick={() => { const folder = folders.find((entry) => entry.id === (menu.target.type === "folder" ? menu.target.id : "")); startFolderEditor(folder); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Pencil size={14} /> Rename</button>
          <button onClick={() => { if (menu.target.type === "folder") void deleteFolder(menu.target.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-error hover:bg-hover"><Trash2 size={14} /> Delete folder</button>
        </> : <>
          <button onClick={() => { const item = items.find((entry) => entry.id === (menu.target.type === "item" ? menu.target.id : "")); setMenu(null); if (item) void selectItem(item); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Pencil size={14} /> Open / Edit</button>
          <button onClick={() => { const item = items.find((entry) => entry.id === (menu.target.type === "item" ? menu.target.id : "")); if (item) void navigator.clipboard.writeText(item.content); setMenu(null); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Copy size={14} /> Copy content</button>
          <button onClick={() => { if (menu.target.type === "item") void removeItem(menu.target.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-error hover:bg-hover"><Trash2 size={14} /> Delete</button>
        </>}
      </div>}

      {message && !selectedId && !dirty && <div className="fixed bottom-4 right-4 z-[140] rounded-lg border border-border bg-bg px-3 py-2 text-xs text-soft shadow-xl">{message}<button onClick={() => setMessage("")} className="ml-3 text-muted hover:text-text" aria-label="Dismiss"><X size={12} className="inline" /></button></div>}
    </section>
  );
}
