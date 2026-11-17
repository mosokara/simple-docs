# Simple Docs

Simple Docs is a local-first Windows desktop app for managing notes and code, organized in nested folders and stored in a private SQLite database.

## Current development status

- Stable release: v1.0.0
- Package version: v1.1.0
- Current work: v2 development on `v2-development` (not released yet)

## Features

- Create, edit, preview, search, and delete notes.
- Create and edit code files with language selection, syntax highlighting, and copy.
- Organize notes and code in nested folders for languages, courses, or tracks.
- Recent and Favorites navigation.
- Double-click an item's title to rename it; the new title is saved on Enter or when focus leaves the field.
- Edit/Preview toggle, Ctrl+S saving, and an unsaved-changes warning when closing the app.
- Right-click context menus for folders and items.
- Resizable sidebar with its width remembered locally.
- Light and dark themes.
- SQLite storage inside Electron's app user-data directory. User content is not stored in the repository.

## Editor behavior

- New notes and code open in Edit mode.
- Existing items open in Preview mode.
- Use the pencil button to switch between Edit and Preview.
- Press Ctrl+S to save. A Save action appears in the footer while there are unsaved changes.
- Closing the app with unsaved changes triggers the standard browser/Electron confirmation.
- Double-click the title to rename. Press Enter or click outside the title field to save the new name.

## Folder behavior

Folders support nested folders and contain notes or code items. A folder must be empty before it can be deleted; this prevents accidental deletion of its contents. Right-click a folder to create a subfolder, note, or code item, rename it, or delete it.

## Electron architecture

```text
Next.js + React
      ↓
typed desktop API
      ↓
restricted preload contextBridge
      ↓
IPC handlers in Electron main
      ↓
SQLite database in app user-data
```

The renderer has no direct access to Node.js or SQLite. All database operations stay in Electron's main process and use parameterized SQL.

## Project structure

```text
app/
  globals.css
  layout.tsx
  page.tsx
components/
  code-viewer.tsx
  docs-app.tsx
  docs-header.tsx
  notes-workspace.tsx
electron/
  database.cjs
  database.test.cjs
  main.cjs
  preload.cjs
lib/
  desktop-api.ts
types/
  library.ts
  electron.d.ts
.dev/
  developer documentation
build/
  icon.ico
```

## Local development

Requirements: Windows, Node.js 24+, npm.

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run dist
```

The SQLite database is stored in Electron's user-data directory. Do not commit database files, personal notes, code, or backups to GitHub.

## Releases

Windows x64 releases use electron-builder (NSIS + ZIP) and electron-updater. See `RELEASING.md` before publishing.

## License

See the repository license file for the terms that apply to Simple Docs.
