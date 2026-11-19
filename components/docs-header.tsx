"use client";

import { Menu, Search, X } from "lucide-react";

export function DocsHeader({
  query,
  onQueryChange,
  mobileOpen,
  onToggleMobile,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-bg px-4 md:px-6">
      <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center text-muted hover:bg-hover md:hidden" onClick={onToggleMobile} aria-label="Toggle sidebar">
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <div className="shrink-0 text-base font-semibold tracking-tight">
        <span className="text-brand">Simple</span> Docs
      </div>
      <label className="relative ml-auto min-w-0 w-full max-w-[440px] flex-none">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-placeholder" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search notes and code…"
          className="h-9 w-full border border-border bg-bg-soft pl-9 pr-10 text-sm text-text outline-none placeholder:text-placeholder focus:border-brand"
          aria-label="Search Library"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted hover:bg-hover" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </label>
    </header>
  );
}
