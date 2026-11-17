# Architecture

## Product workspaces

Simple Docs has two independent local-first workspaces:

- **Library**: notes and code snippets stored in a private SQLite database under `app.getPath("userData")`.
- **Files**: the existing Explorer-style browser for real folders. Files remain in their original locations and are never silently imported into the Library.

The Library is the primary workspace. The Files workspace is retained for compatibility and direct access to existing documentation folders.

## Runtime layers

```text
Next.js / React renderer
      ↓
typed lib/desktop-api.ts
      ↓
restricted electron/preload.cjs contextBridge
      ↓
IPC handlers in electron/main.cjs
      ├─ electron/database.cjs → SQLite in app userData
      └─ filesystem / dialogs / Explorer / editor / watcher / ZIP
```

## Storage boundaries

- Renderer components must not access SQLite, Node.js APIs, or the filesystem directly.
- All Library reads and writes go through typed desktop API methods and IPC.
- SQLite is stored outside the repository and outside any selected Files folder.
- The database schema is initialized by `electron/database.cjs`; schema changes must use explicit, versioned migrations.
- Notes and snippets share one table and are distinguished by the `kind` field.
- Categories, tags, and note-tag relationships have dedicated tables for future organization features.
- Never commit a user's database, notes, snippets, or backups to GitHub.

## Library save flow

```text
NotesWorkspace
  ↓
desktop.saveLibraryItem(input)
  ↓
preload IPC: library:save
  ↓
main.cjs IPC handler
  ↓
database.cjs validation + parameterized SQLite query
  ↓
saved LibraryNote returned to renderer
```

## Library open flow

Opening an item updates its `last_opened_at` timestamp. Favorites are stored as a boolean flag. Search currently covers title and content, with a bounded result set.

## Files workspace

The existing filesystem architecture remains unchanged:

```text
Windows filesystem
      ↓
electron/main.cjs
      ↓
electron/preload.cjs
      ↓
lib/desktop-api.ts
      ↓
DocsApp / DocsSidebar / FileViewer
```

`scanFolder()` builds a recursive `DocFolder` tree. The root uses relative path `""`; a child folder receives its real relative path. Creation actions pass that path unchanged.

## Files create flow

```text
UI button
  ↓
DocsApp.openCreateDialog(type, parentPath)
  ↓
desktop.createFolder/createFile(parentPath, name)
  ↓
preload IPC
  ↓
main createFolder/createFile
  ↓
validation + filesystem write
  ↓
scan + watcher refresh
```

## Delete flow

- Library deletion removes one database record; its confirmation is handled in the renderer.
- Files deletion sends a relative root-item path. Electron main verifies that the target stays inside the opened root, asks for native confirmation, removes the nested file/folder, clears deleted selection state, and schedules a refresh.

## Backups and migration status

The existing ZIP action backs up the selected Files folder only. It does not include the SQLite Library database. A separate Library backup/restore flow and a safe, non-destructive Markdown/TXT import flow must be implemented before describing the app as having complete backup or migration support.

## Security rules

- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Do not expose raw `fs`, `path`, `child_process`, `ipcRenderer`, or SQLite objects to the renderer.
- Validate IPC input in the main process and use parameterized SQL statements.
- Treat all future import/restore paths as untrusted input and prevent path traversal.
