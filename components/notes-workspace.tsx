"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Code2, Copy, FileText, Folder, FolderPlus, Heart, ChevronRight, ChevronDown,
  Plus, Search, Pencil, Eye, Trash2, MoreHorizontal, FilePlus2, Clock3, Star, X,
  CalendarDays, FileCode2,
} from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { CodeViewer } from "./code-viewer";
import { CodeEditor } from "./code-editor";
import { desktop } from "@/lib/desktop-api";
import type { LibraryFolder, LibraryItemKind, LibraryNote } from "@/types/library";

const MIN_WIDTH = 220;
const MAX_WIDTH = 440;
const DEFAULT_WIDTH = 288;
const DRAG_TYPE = "application/x-simple-docs-library-item";

const EXTENSION_LANGUAGES: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx", ts: "typescript", mts: "typescript", cts: "typescript",
  tsx: "tsx", py: "python", html: "html", htm: "html",
  css: "css", scss: "scss", less: "less", sql: "sql", sh: "bash",
  bash: "bash", json: "json", md: "markdown", yml: "yaml", yaml: "yaml",
  xml: "xml", svg: "xml", c: "c", h: "c", cpp: "cpp", hpp: "cpp",
  java: "java", go: "go", rs: "rust", php: "php", rb: "ruby",
  txt: "text", text: "text",
};

type ActiveView = { type: "recent" | "favorites" | "folder"; folderId?: string | null };
type MenuState = {
  x: number;
  y: number;
  target: { type: "folder"; id: string } | { type: "item"; id: string };
} | null;
type NewItemState = { kind: LibraryItemKind; folderId: string | null } | null;
type DragPayload = { type: "folder" | "item"; id: string };

function languageForFile(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_LANGUAGES[extension] ?? "text";
}

function ensureCodeExtension(fileName: string) {
  return fileName.includes(".") ? fileName : fileName + ".js";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  try {
    const value = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as DragPayload;
    return value && (value.type === "folder" || value.type === "item") && typeof value.id === "string"
      ? value
      : null;
  } catch {
    return null;
  }
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
  const [allItems, setAllItems] = useState<LibraryNote[]>([]);
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
  const [folderEditor, setFolderEditor] = useState<{ id?: string; parentId?: string | null } | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [newItem, setNewItem] = useState<NewItemState>(null);
  const [newItemName, setNewItemName] = useState("");
  const [dialogError, setDialogError] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const cancelTitleEditRef = useRef(false);
  const resizeRef = useRef<{ x: number; width: number } | null>(null);
  const dataRequestRef = useRef(0);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const refreshData = useCallback(async () => {
    const requestId = ++dataRequestRef.current;
    const [nextItems, nextFolders] = await Promise.all([
      desktop.listLibraryItems(),
      desktop.listFolders(),
    ]);
    if (requestId !== dataRequestRef.current) return;
    setAllItems(nextItems);
    setFolders(nextFolders);
  }, []);

  useEffect(() => {
    void refreshData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load your library.");
    });
    return () => { dataRequestRef.current += 1; };
  }, [refreshData]);

  useEffect(() => {
    if (!editingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editingTitle]);

  useEffect(() => {
    if (!newItem) return;
    newItemInputRef.current?.focus();
    newItemInputRef.current?.select();
  }, [newItem]);

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
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, resizeRef.current.width + event.clientX - resizeRef.current.x),
      );
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
      if (event.key === "Escape") {
        setMenu(null);
        setFolderEditor(null);
      }
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
    // The shortcut intentionally uses the latest editor state captured by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, content, kind, language, selectedId, folderId, busy]);

  const visibleItems = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    let result = allItems;
    if (search) {
      result = allItems.filter((item) =>
        item.title.toLocaleLowerCase().includes(search) ||
        item.content.toLocaleLowerCase().includes(search),
      );
    } else if (activeView.type === "favorites") {
      result = allItems.filter((item) => item.favorite);
    } else if (activeView.type === "folder") {
      result = allItems.filter((item) => item.folderId === (activeView.folderId ?? null));
    } else {
      result = [...allItems].sort((a, b) => {
        const aDate = new Date(a.lastOpenedAt ?? a.updatedAt).getTime();
        const bDate = new Date(b.lastOpenedAt ?? b.updatedAt).getTime();
        return bDate - aDate;
      });
    }
    return result;
  }, [allItems, query, activeView]);

  const activeFolder = activeView.type === "folder" && activeView.folderId
    ? folders.find((folder) => folder.id === activeView.folderId) ?? null
    : null;
  const pageTitle = query.trim()
    ? "Search results"
    : activeView.type === "favorites"
      ? "Favorites"
      : activeView.type === "folder"
        ? activeFolder?.name ?? "Root Directory"
        : "Recent";
  const visibleFolders = !query.trim() && activeView.type === "folder"
    ? folders.filter((folder) => folder.parentId === (activeView.folderId ?? null))
    : [];
  const hasFolderContents = visibleFolders.length > 0 || visibleItems.length > 0;

  function folderChildren(parentId: string | null) {
    return folders.filter((folder) => folder.parentId === parentId);
  }

  function itemsInFolder(parentId: string | null) {
    return allItems.filter((item) => item.folderId === parentId);
  }

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
    const menuHeight = target.type === "folder" ? 220 : 132;
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
      target,
    });
  }

  async function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  async function openFolder(folder: LibraryFolder | null) {
    if (!await confirmDiscard()) return;
    setSelectedId(null);
    setTitle("");
    setContent("");
    setDirty(false);
    setEditing(false);
    setEditingTitle(false);
    setActiveView({ type: "folder", folderId: folder?.id ?? null });
    setMessage("");
    onCloseMobile();
  }

  async function selectItem(item: LibraryNote) {
    if (!await confirmDiscard()) return;
    try {
      const opened = await desktop.openLibraryItem(item.id);
      setSelectedId(opened.id);
      setTitle(opened.title);
      setContent(opened.content);
      setKind(opened.kind);
      setLanguage(opened.kind === "snippet" ? (/\.[a-z0-9]+$/i.test(opened.title) ? languageForFile(opened.title) : opened.language ?? "javascript") : "text");
      setFolderId(opened.folderId);
      setEditing(false);
      setDirty(false);
      setMessage("");
      onCloseMobile();
      void refreshData().catch(() => {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open this item.");
    }
  }

  async function startNew(nextKind: LibraryItemKind, targetFolderId: string | null = null) {
    if (!await confirmDiscard()) return;
    setSelectedId(null);
    setTitle("");
    setContent("");
    setKind(nextKind);
    setLanguage("javascript");
    setFolderId(targetFolderId);
    setEditing(false);
    setEditingTitle(false);
    setDirty(false);
    setMessage("");
    setDialogError("");
    setNewItemName(nextKind === "snippet" ? "untitled.js" : "Untitled Note");
    setNewItem({ kind: nextKind, folderId: targetFolderId });
    onCloseMobile();
  }

  function confirmNewItem(event: React.FormEvent) {
    event.preventDefault();
    const requestedName = newItemName.trim();
    if (!requestedName) {
      setDialogError("Enter a file name before continuing.");
      newItemInputRef.current?.focus();
      return;
    }
    const createdName = newItem?.kind === "snippet" ? ensureCodeExtension(requestedName) : requestedName;
    setTitle(createdName);
    setTitleDraft(createdName);
    setContent("");
    setKind(newItem?.kind ?? "note");
    setLanguage(newItem?.kind === "snippet" ? languageForFile(createdName) : "text");
    setFolderId(newItem?.folderId ?? null);
    setEditing(true);
    setDirty(true);
    setNewItem(null);
    setDialogError("");
  }

  async function save() {
    if (busy || !dirty) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setMessage("A file name is required.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const nextLanguage = kind === "snippet" ? (/\.[a-z0-9]+$/i.test(cleanTitle) ? languageForFile(cleanTitle) : language) : null;
      const saved = await desktop.saveLibraryItem({
        id: selectedId ?? undefined,
        title: cleanTitle,
        content,
        kind,
        language: nextLanguage,
        folderId,
      });
      setSelectedId(saved.id);
      setTitle(saved.title);
      setLanguage(nextLanguage ?? "text");
      setDirty(false);
      setEditing(false);
      setEditingTitle(false);
      setMessage("All changes saved");
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    let item: LibraryNote;
    try {
      item = await desktop.openLibraryItem(id);
    } catch {
      setMessage("This item no longer exists.");
      await refreshData();
      return;
    }
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;
    try {
      await desktop.deleteLibraryItem(id);
      if (selectedId === id) {
        setSelectedId(null);
        setTitle("");
        setContent("");
        setDirty(false);
        setEditing(false);
      }
      setMenu(null);
      await refreshData();
      setMessage("Item deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this item.");
    }
  }

  async function toggleFavorite(item: LibraryNote, event?: React.MouseEvent) {
    event?.stopPropagation();
    try {
      await desktop.setLibraryFavorite(item.id, !item.favorite);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update favorite.");
    }
  }

  function startFolderEditor(folder?: LibraryFolder, parentId: string | null = null) {
    setMenu(null);
    setFolderEditor(folder ? { id: folder.id } : { parentId });
    setFolderNameDraft(folder?.name ?? "");
    setMessage("");
  }

  async function submitFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!folderNameDraft.trim()) {
      setMessage("A folder name is required.");
      return;
    }
    try {
      if (folderEditor?.id) {
        await desktop.renameFolder(folderEditor.id, folderNameDraft);
      } else {
        const created = await desktop.createFolder(folderNameDraft, folderEditor?.parentId ?? null);
        if (created.parentId) {
          setExpanded((current) => current.includes(created.parentId!) ? current : [...current, created.parentId!]);
        }
      }
      setFolderEditor(null);
      setFolderNameDraft("");
      await refreshData();
      setMessage("Folder saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save folder.");
    }
  }

  async function deleteFolder(id: string) {
    const folder = folders.find((entry) => entry.id === id);
    if (!folder || !window.confirm(`Delete folder "${folder.name}"? Only empty folders can be deleted.`)) return;
    try {
      await desktop.deleteFolder(id);
      if (activeView.type === "folder" && activeView.folderId === id) {
        setActiveView({ type: "recent" });
      }
      setMenu(null);
      await refreshData();
      setMessage("Folder deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete folder. Move or delete its contents first.");
    }
  }

  async function commitTitle() {
    if (cancelTitleEditRef.current) {
      cancelTitleEditRef.current = false;
      setEditingTitle(false);
      return;
    }
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === title) {
      setTitleDraft(title);
      return;
    }
    if (!selectedId) {
      setTitle(nextTitle);
      if (kind === "snippet") setLanguage(languageForFile(nextTitle));
      setDirty(true);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const nextLanguage = kind === "snippet" ? (/\.[a-z0-9]+$/i.test(nextTitle) ? languageForFile(nextTitle) : language) : null;
      const saved = await desktop.saveLibraryItem({
        id: selectedId,
        title: nextTitle,
        content,
        kind,
        language: nextLanguage,
        folderId,
      });
      setTitle(saved.title);
      if (nextLanguage) setLanguage(nextLanguage);
      setDirty(false);
      await refreshData();
      setMessage("File name saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not rename this file.");
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(event: React.DragEvent, payload: DragPayload) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", payload.id);
  }

  function onDragOver(event: React.DragEvent) {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  async function moveToFolder(event: React.DragEvent, targetFolderId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    if (!payload) return;
    try {
      if (payload.type === "folder") {
        await desktop.moveFolder(payload.id, targetFolderId);
      } else {
        await desktop.moveLibraryItem(payload.id, targetFolderId);
      }
      await refreshData();
      setMessage(targetFolderId ? "Moved successfully" : "Moved to Root Directory");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not move this item.");
    }
  }

  const markdownHtml = mounted ? DOMPurify.sanitize(marked.parse(content) as string) : "";

  function renderFolder(folder: LibraryFolder, depth = 0): React.ReactNode {
    const isExpanded = expanded.includes(folder.id);
    const isActive = activeView.type === "folder" && activeView.folderId === folder.id && !selectedId && !dirty;
    const children = folderChildren(folder.id);
    const docs = itemsInFolder(folder.id);
    return (
      <div key={folder.id} className="select-none">
        <div
          draggable
          onDragStart={(event) => onDragStart(event, { type: "folder", id: folder.id })}
          onDragOver={onDragOver}
          onDrop={(event) => void moveToFolder(event, folder.id)}
          onClick={() => void openFolder(folder)}
          onContextMenu={(event) => openMenu(event, { type: "folder", id: folder.id })}
          className={`tree-row group flex min-h-9 items-center pr-2 ${isActive ? "tree-row-active" : ""}`}
          style={{ paddingLeft: 7 + depth * 15 }}
          title={folder.name}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((current) => isExpanded ? current.filter((id) => id !== folder.id) : [...current, folder.id]);
            }}
            className="flex h-8 w-7 shrink-0 items-center justify-center text-muted hover:text-text"
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <Folder size={15} className="mr-2 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-xs text-soft">{folder.name}</span>
          <span className="mr-2 text-[10px] text-muted">{children.length + docs.length}</span>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); openMenu(event, { type: "folder", id: folder.id }); }}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-text"
            title="Folder actions"
            aria-label="Folder actions"
          >
            <MoreHorizontal size={14} />
          </button>
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

  function renderItem(item: LibraryNote, depth = 0): React.ReactNode {
    const isActive = selectedId === item.id;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(event) => onDragStart(event, { type: "item", id: item.id })}
        onClick={() => void selectItem(item)}
        onContextMenu={(event) => openMenu(event, { type: "item", id: item.id })}
        className={`tree-row group flex min-h-9 items-center pr-2 ${isActive ? "tree-row-active" : ""}`}
        style={{ paddingLeft: 31 + depth * 15 }}
        title={item.title}
      >
        {item.kind === "snippet"
          ? <Code2 size={14} className="mr-2 shrink-0 text-brand" />
          : <FileText size={14} className="mr-2 shrink-0 text-muted" />}
        <span className="min-w-0 flex-1 truncate text-xs text-soft">{item.title}</span>
        <button
          type="button"
          onClick={(event) => void toggleFavorite(item, event)}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-brand"
          title={item.favorite ? "Remove favorite" : "Add favorite"}
          aria-label={item.favorite ? "Remove favorite" : "Add favorite"}
        >
          <Heart size={12} fill={item.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  function renderMainFolder(folder: LibraryFolder) {
    const childCount = folderChildren(folder.id).length + itemsInFolder(folder.id).length;
    return (
      <div
        key={folder.id}
        draggable
        onDragStart={(event) => onDragStart(event, { type: "folder", id: folder.id })}
        onDragOver={onDragOver}
        onDrop={(event) => void moveToFolder(event, folder.id)}
        onClick={() => void openFolder(folder)}
        onContextMenu={(event) => openMenu(event, { type: "folder", id: folder.id })}
        className="main-list-row group flex min-h-12 items-center gap-3 border-b border-border px-3 text-left hover:bg-hover"
      >
        <Folder size={17} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{folder.name}</span>
        <span className="text-xs text-muted">{childCount} items</span>
        <span className="hidden items-center gap-1 text-xs text-muted sm:flex"><CalendarDays size={13} />{formatDate(folder.createdAt)}</span>
        <ChevronRight size={15} className="text-muted" />
      </div>
    );
  }

  function renderMainItem(item: LibraryNote) {
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(event) => onDragStart(event, { type: "item", id: item.id })}
        onClick={() => void selectItem(item)}
        onContextMenu={(event) => openMenu(event, { type: "item", id: item.id })}
        className="main-list-row group flex min-h-12 items-center gap-3 border-b border-border px-3 text-left hover:bg-hover"
      >
        {item.kind === "snippet"
          ? <FileCode2 size={17} className="shrink-0 text-brand" />
          : <FileText size={17} className="shrink-0 text-muted" />}
        <span className="min-w-0 flex-1 truncate text-sm text-text">{item.title}</span>
        <span className="hidden text-xs text-muted sm:block">{item.kind === "snippet" ? languageForFile(item.title) : "Note"}</span>
        <span className="hidden items-center gap-1 text-xs text-muted sm:flex"><CalendarDays size={13} />{formatDate(item.createdAt)}</span>
        <button
          type="button"
          onClick={(event) => void toggleFavorite(item, event)}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted hover:text-brand"
          title={item.favorite ? "Remove favorite" : "Add favorite"}
          aria-label={item.favorite ? "Remove favorite" : "Add favorite"}
        >
          <Heart size={14} fill={item.favorite ? "currentColor" : "none"} />
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
            <button type="button" onClick={() => void startNew("note", null)} className="flex h-9 items-center justify-center gap-2 border border-border bg-bg text-xs font-medium text-soft transition-colors hover:bg-hover hover:text-text"><FilePlus2 size={14} /> Note</button>
            <button type="button" onClick={() => void startNew("snippet", null)} className="flex h-9 items-center justify-center gap-2 border border-border bg-bg text-xs font-medium text-soft transition-colors hover:bg-hover hover:text-text"><Code2 size={14} /> Code</button>
          </div>

          <div className="shrink-0 space-y-0.5 border-b border-border px-2 py-2">
            <button type="button" onClick={async () => { if (!await confirmDiscard()) return; setSelectedId(null); setDirty(false); setActiveView({ type: "recent" }); }} className={"flex w-full items-center gap-2 px-3 py-2 text-left text-xs " + (activeView.type === "recent" && !selectedId && !dirty ? "nav-row-active" : "nav-row")}><Clock3 size={15} /> Recent</button>
            <button type="button" onClick={async () => { if (!await confirmDiscard()) return; setSelectedId(null); setDirty(false); setActiveView({ type: "favorites" }); }} className={"flex w-full items-center gap-2 px-3 py-2 text-left text-xs " + (activeView.type === "favorites" && !selectedId && !dirty ? "nav-row-active" : "nav-row")}><Star size={15} /> Favorites</button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between px-3">
              <button type="button" onClick={() => void openFolder(null)} className={"text-[10px] font-semibold uppercase tracking-[0.12em] " + (activeView.type === "folder" && activeView.folderId === null && !selectedId ? "text-brand" : "text-muted")}>Folders</button>
              <button type="button" onClick={() => startFolderEditor(undefined, null)} className="flex h-8 w-8 items-center justify-center text-muted hover:bg-hover hover:text-text" title="New root folder" aria-label="New root folder"><Plus size={15} /></button>
            </div>
            <div
              className="docs-scroll min-h-0 flex-1 overflow-y-auto pb-3"
              onDragOver={onDragOver}
              onDrop={(event) => void moveToFolder(event, null)}
            >
              {folderChildren(null).map((folder) => renderFolder(folder))}
              {itemsInFolder(null).map((item) => renderItem(item))}
              {!folders.length && !itemsInFolder(null).length && (
                <p className="px-3 py-3 text-[11px] leading-5 text-muted">Your root directory is empty. Create a folder, note, or code file to get started.</p>
              )}
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

      {mobileOpen && <button type="button" className="fixed inset-0 z-20 bg-black/35 md:hidden" onClick={onCloseMobile} aria-label="Close sidebar" />}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {selectedId || dirty ? (
          <>
            <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-5">
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => void commitTitle()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                      if (event.key === "Escape") {
                        cancelTitleEditRef.current = true;
                        setTitleDraft(title);
                        setEditingTitle(false);
                      }
                    }}
                    className="h-8 w-full border-b border-brand bg-transparent text-sm font-semibold outline-none"
                    aria-label="File name"
                  />
                ) : (
                  <button type="button" onDoubleClick={() => { setTitleDraft(title); setEditingTitle(true); }} className="max-w-full truncate text-left text-sm font-semibold text-text" title="Double-click to rename">{title || "Untitled"}</button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5 border border-border bg-bg-alt p-1">
                <button type="button" onClick={() => setEditing((value) => !value)} className={"flex h-8 w-8 items-center justify-center transition-colors hover:bg-hover " + (editing ? "text-brand" : "text-muted hover:text-text")} title={editing ? "Preview" : "Edit"} aria-label={editing ? "Preview" : "Edit"}>{editing ? <Eye size={15} /> : <Pencil size={15} />}</button>
                <button type="button" onClick={() => void navigator.clipboard.writeText(content).then(() => setMessage("Copied to clipboard")).catch(() => setMessage("Clipboard access was denied."))} className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-hover hover:text-text" title="Copy" aria-label="Copy"><Copy size={15} /></button>
                <button type="button" onClick={() => void removeItem(selectedId!)} className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-hover hover:text-error" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
              </div>

              {kind === "snippet" && (
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty || busy}
                  className="flex h-9 shrink-0 items-center gap-2 border border-border bg-bg px-3 text-xs font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  title="Save (Ctrl + S)"
                >
                  Save <kbd className="border border-border bg-bg-alt px-1.5 py-0.5 text-[10px] font-normal text-muted">Ctrl + S</kbd>
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-5">
              {editing ? (
                kind === "snippet" ? (
                  <CodeEditor
                    value={content}
                    onChange={(value) => { setContent(value); setDirty(true); }}
                    placeholder="// Write or paste your code here…"
                  />
                ) : (
                  <textarea
                    autoFocus
                    value={content}
                    onChange={(event) => { setContent(event.target.value); setDirty(true); }}
                    className="docs-scroll h-full min-h-0 w-full resize-none border border-border bg-bg-alt p-5 text-sm leading-7 text-soft outline-none focus:border-brand"
                    placeholder="Start writing your note…"
                  />
                )
              ) : kind === "snippet" ? (
                <div className="docs-scroll h-full overflow-auto border border-border bg-code-bg p-4">
                  <CodeViewer code={content} fileName={title} language={language} />
                </div>
              ) : (
                <article className="markdown docs-scroll h-full overflow-auto px-2 py-1" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
              )}
            </div>

            <div className="flex h-11 shrink-0 items-center justify-between border-t border-border px-4 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-[11px] text-muted">{message || (dirty ? "Unsaved changes" : "All changes saved")}</span>
                {kind === "note" && dirty && <button type="button" onClick={() => void save()} disabled={busy} className="px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>}
              </div>
              <span className="shrink-0 text-[10px] text-muted">
                {kind === "snippet" ? `${content.split("\n").length.toLocaleString()} lines` : `${content.length.toLocaleString()} chars`}
              </span>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-5"
              onDragOver={activeView.type === "folder" ? onDragOver : undefined}
              onDrop={activeView.type === "folder" ? (event) => void moveToFolder(event, activeView.folderId ?? null) : undefined}
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{pageTitle}</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  {activeView.type === "folder" && !query.trim() ? visibleFolders.length + visibleItems.length : visibleItems.length} {visibleItems.length + visibleFolders.length === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeView.type === "folder" && !query.trim() && (
                  <>
                    <button type="button" onClick={() => startFolderEditor(undefined, activeView.folderId ?? null)} className="flex h-8 items-center gap-2 border border-border px-3 text-xs text-soft hover:bg-hover"><FolderPlus size={14} /> New Folder</button>
                    <button type="button" onClick={() => void startNew("note", activeView.folderId ?? null)} className="flex h-8 items-center gap-2 border border-border px-3 text-xs text-soft hover:bg-hover"><FilePlus2 size={14} /> New Note</button>
                    <button type="button" onClick={() => void startNew("snippet", activeView.folderId ?? null)} className="flex h-8 items-center gap-2 border border-border px-3 text-xs text-soft hover:bg-hover"><Code2 size={14} /> New Code</button>
                  </>
                )}
              </div>
            </div>

            <div
              className="docs-scroll min-h-0 flex-1 overflow-y-auto"
              onDragOver={activeView.type === "folder" ? onDragOver : undefined}
              onDrop={activeView.type === "folder" ? (event) => void moveToFolder(event, activeView.folderId ?? null) : undefined}
            >
              {visibleFolders.map((folder) => renderMainFolder(folder))}
              {visibleItems.map((item) => renderMainItem(item))}
              {!hasFolderContents && (
                <div className="flex min-h-full flex-col items-center justify-center px-5 py-12 text-center">
                  <div className="border border-border bg-bg-alt p-4 text-brand"><Search size={23} /></div>
                  <h3 className="mt-4 text-sm font-semibold">{query.trim() ? "No matching items" : "Nothing here yet"}</h3>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-muted">
                    {query.trim()
                      ? "Try another search term."
                      : activeView.type === "folder"
                        ? "Create a folder, note, or code file here, or drag an item into this directory."
                        : "Create a note or code file to get started. New files are saved in the Root Directory."}
                  </p>
                  {!query.trim() && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => void startNew("note", activeView.type === "folder" ? activeView.folderId ?? null : null)} className="flex h-9 items-center gap-2 bg-brand px-3 text-xs font-medium text-black"><FilePlus2 size={14} /> New Note</button>
                      <button type="button" onClick={() => void startNew("snippet", activeView.type === "folder" ? activeView.folderId ?? null : null)} className="flex h-9 items-center gap-2 border border-border px-3 text-xs text-soft hover:bg-hover"><Code2 size={14} /> New Code</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {folderEditor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFolderEditor(null); }}>
          <form onSubmit={(event) => void submitFolder(event)} className="w-full max-w-sm border border-border bg-bg p-5 shadow-2xl">
            <h3 className="text-sm font-semibold">{folderEditor.id ? "Rename folder" : folderEditor.parentId ? "New folder" : "New root folder"}</h3>
            <input autoFocus value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} placeholder="Folder name" className="mt-4 h-10 w-full border border-border bg-bg-alt px-3 text-sm outline-none focus:border-brand" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setFolderEditor(null)} className="h-9 px-3 text-xs text-muted hover:bg-hover">Cancel</button>
              <button type="submit" className="h-9 bg-brand px-3 text-xs font-medium text-black">Save</button>
            </div>
          </form>
        </div>
      )}

      {newItem && (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewItem(null); }}>
          <form onSubmit={confirmNewItem} className="w-full max-w-sm border border-border bg-bg p-5 shadow-2xl">
            <h3 className="text-sm font-semibold">New {newItem.kind === "snippet" ? "code file" : "note"}</h3>
            <p className="mt-1 text-xs text-muted">Choose a name for your new {newItem.kind === "snippet" ? "code file" : "note"}.</p>
            <input
              ref={newItemInputRef}
              value={newItemName}
              onChange={(event) => { setNewItemName(event.target.value); setDialogError(""); }}
              placeholder={newItem.kind === "snippet" ? "untitled.js" : "Untitled Note"}
              className="mt-4 h-10 w-full border border-border bg-bg-alt px-3 text-sm outline-none focus:border-brand"
              aria-label="File name"
            />
            {newItem.kind === "snippet" && <p className="mt-2 text-[11px] text-muted">The file extension determines syntax highlighting and language.</p>}
            {dialogError && <p className="mt-2 text-xs text-error">{dialogError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNewItem(null)} className="h-9 px-3 text-xs text-muted hover:bg-hover">Cancel</button>
              <button type="submit" className="h-9 bg-brand px-3 text-xs font-medium text-black">Create</button>
            </div>
          </form>
        </div>
      )}

      {menu && (
        <div className="fixed z-[120] min-w-[210px] border border-border bg-bg p-1.5 shadow-xl" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
          {menu.target.type === "folder" ? (
            <>
              <button type="button" onClick={() => startFolderEditor(undefined, menu.target.type === "folder" ? menu.target.id : null)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><FolderPlus size={14} /> New Folder</button>
              <button type="button" onClick={() => { const id = menu.target.type === "folder" ? menu.target.id : null; setActiveView({ type: "folder", folderId: id }); setMenu(null); void startNew("note", id); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><FilePlus2 size={14} /> New Note</button>
              <button type="button" onClick={() => { const id = menu.target.type === "folder" ? menu.target.id : null; setActiveView({ type: "folder", folderId: id }); setMenu(null); void startNew("snippet", id); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Code2 size={14} /> New Code</button>
              <div className="my-1 border-t border-border" />
              <button type="button" onClick={() => { const folder = folders.find((entry) => entry.id === (menu.target.type === "folder" ? menu.target.id : "")); startFolderEditor(folder); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Pencil size={14} /> Rename</button>
              <button type="button" onClick={() => { if (menu.target.type === "folder") void deleteFolder(menu.target.id); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-error hover:bg-hover"><Trash2 size={14} /> Delete</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { const item = allItems.find((entry) => entry.id === (menu.target.type === "item" ? menu.target.id : "")); setMenu(null); if (item) void selectItem(item); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Pencil size={14} /> Open / Edit</button>
              <button type="button" onClick={() => { const item = allItems.find((entry) => entry.id === (menu.target.type === "item" ? menu.target.id : "")); if (item) void navigator.clipboard.writeText(item.content).then(() => setMessage("Copied to clipboard")).catch(() => setMessage("Clipboard access was denied.")); setMenu(null); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-soft hover:bg-hover"><Copy size={14} /> Copy content</button>
              <button type="button" onClick={() => { if (menu.target.type === "item") void removeItem(menu.target.id); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-error hover:bg-hover"><Trash2 size={14} /> Delete</button>
            </>
          )}
        </div>
      )}

      {message && !selectedId && !dirty && !folderEditor && !newItem && (
        <div className="fixed bottom-4 right-4 z-[140] border border-border bg-bg px-3 py-2 text-xs text-soft shadow-xl">
          {message}
          <button type="button" onClick={() => setMessage("")} className="ml-3 text-muted hover:text-text" aria-label="Dismiss"><X size={12} className="inline" /></button>
        </div>
      )}
    </section>
  );
}
