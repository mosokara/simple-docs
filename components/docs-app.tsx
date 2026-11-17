"use client";

import { useState } from "react";
import { DocsHeader } from "./docs-header";
import { NotesWorkspace } from "./notes-workspace";

export function DocsApp() {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg text-text">
      <DocsHeader
        query={query}
        onQueryChange={setQuery}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <NotesWorkspace query={query} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
    </div>
  );
}
