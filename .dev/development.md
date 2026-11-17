# Development Workflow

## Requirements

- Windows
- Node.js LTS
- npm
- VS Code recommended

## Run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run lint
npm run build
npm run dist
```

## Development loop

1. Work on the feature branch.
2. Make one focused change.
3. Run typecheck and lint.
4. Start Electron and exercise the exact user flow.
5. Run `npm run dist` for packaged Windows behavior.
6. Commit the focused change.
7. Push and update the PR.

## Filesystem checklist

Test:
- root and nested creation
- duplicate names
- invalid Windows names
- right click on root-level and deeply nested files/folders
- native delete confirmation
- deleting a folder with contents
- external watcher refresh
- root header double-click and context-menu Open in Explorer
- state restoration

## UI rules

Use existing tokens from `app/globals.css`. Inputs intentionally change only their border color when focused; no large outline is shown.

Use native `title` tooltips for small utility buttons when the requested interaction is simply explanatory text.

## IPC change order

```text
main.cjs
  ↓
preload.cjs
  ↓
types/electron.d.ts
  ↓
lib/desktop-api.ts
  ↓
React component
  ↓
.dev documentation
```

Never expose raw `fs`, `path`, `child_process`, or `ipcRenderer` to the renderer.


## SQLite runtime

The desktop app uses Electron's bundled Node.js runtime and the built-in `node:sqlite` module. Keep SQLite access in the Electron main process. Do not add a native third-party SQLite dependency without first evaluating Electron rebuild and Windows packaging implications.

After changing database code, verify the app in Electron (not only with the system Node version), then run:

```bash
npm run typecheck
npm run lint
npm run build
npm run dist
```

The current Library schema is version 1. Any schema change must add an explicit migration instead of assuming that editing `CREATE TABLE IF NOT EXISTS` updates existing databases.
