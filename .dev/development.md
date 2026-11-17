# Development Workflow

## Requirements

- Windows
- Node.js 24+
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
npm test
npm run build
npm run dist
```

## Development loop

1. Make a focused change on the feature branch.
2. Run typecheck, lint, and tests.
3. Start Electron and exercise the exact user flow.
4. Run `npm run dist` before packaging a Windows release.
5. Commit the focused change and update the PR.

## Library checks

- Create, edit, preview, search, favorite, and delete notes/code.
- Create nested folders and add items to the correct folder.
- Rename folders and titles.
- Reject deleting folders that still contain child folders or items.
- Right-click folders and items.
- Resize the sidebar and verify its width persists after restart.
- Ctrl+S saves; closing with unsaved changes prompts for confirmation.
- Confirm old schema-v1 notes remain visible after migration.

## IPC order

```text
main.cjs → preload.cjs → types/electron.d.ts → lib/desktop-api.ts → React UI
```

Never expose raw Node.js APIs or SQLite objects to the renderer.

## SQLite

Use Electron's bundled Node.js runtime and built-in `node:sqlite`. Keep all SQL in `electron/database.cjs`, use parameterized statements, and add versioned migrations for schema changes. Never store personal content in the Git repository.
