# Architecture

## Runtime

```text
Next.js / React renderer
      ↓
lib/desktop-api.ts
      ↓
electron/preload.cjs (restricted contextBridge)
      ↓
IPC handlers in electron/main.cjs
      ↓
electron/database.cjs
      ↓
SQLite in app.getPath("userData")
```

## Storage

- Notes, code items, favorites, and nested folders are stored in SQLite.
- The database file is `simple-docs.sqlite` under Electron app user data.
- Renderer components never access SQLite or Node.js APIs directly.
- All database access stays in Electron main and uses parameterized SQL.
- Schema changes use explicit migrations. The current schema version is 2.
- Existing schema-v1 notes are retained and receive a null `folder_id`, so they remain available at the Library root.

## Main data model

- `notes`: note/code title, text, kind, language, favorite, timestamps, and optional folder.
- `folders`: nested folders through `parent_id`.
- `categories`, `tags`, and `note_tags`: retained existing organization tables.

Deleting a folder is allowed only when it has no child folders or items. This avoids accidental content deletion.

## IPC flow

```text
NotesWorkspace
  ↓
desktop.saveLibraryItem(input)
  ↓
preload IPC: library:save
  ↓
main.cjs IPC handler
  ↓
database.cjs validation + parameterized SQL
  ↓
LibraryNote returned to renderer
```

## Editor behavior

- New items start in Edit mode.
- Existing items open in Preview mode.
- Ctrl+S invokes the save operation.
- A beforeunload handler warns when the current editor has unsaved changes.
- Title editing starts on double-click and commits on Enter or blur.

## Security

- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Never expose `fs`, `path`, `child_process`, `ipcRenderer`, or SQLite objects to the renderer.
- Validate IPC input and use parameterized SQL.
- Keep user data out of Git and the application source tree.
