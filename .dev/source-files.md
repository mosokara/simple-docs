# Source Files

- `app/page.tsx`: entry route rendering DocsApp.
- `app/layout.tsx`: HTML shell and app metadata.
- `app/globals.css`: design tokens, light/dark themes, scrollbars, Markdown and code preview styling.
- `components/docs-app.tsx`: compact app shell and global search state.
- `components/docs-header.tsx`: Simple Docs branding and global Library search.
- `components/notes-workspace.tsx`: Library navigation, nested folder tree, context menus, resizing, editor, preview, title rename, keyboard save, and unsaved-change handling.
- `components/code-viewer.tsx`: Shiki syntax highlighting with text fallback and DOMPurify sanitization.
- `electron/database.cjs`: SQLite schema, migrations, notes/code CRUD, favorites, and nested folder operations.
- `electron/database.test.cjs`: storage tests.
- `electron/main.cjs`: Electron lifecycle, secure window, custom packaged-app protocol, IPC handlers, and updater.
- `electron/preload.cjs`: narrow contextBridge API for Library operations only.
- `lib/desktop-api.ts`: typed renderer wrapper over the preload API.
- `types/library.ts`: Library item/folder models and save input.
- `types/electron.d.ts`: window.simpleDocs bridge contract.
- `package.json`: scripts, dependencies, Electron packaging, and updater config.
- `.github/workflows/ci.yml`: typecheck, lint, tests, and Next.js build.
- `.github/workflows/release.yml`: Windows release pipeline.
- `.dev/`: engineering documentation.

Legacy filesystem UI, filesystem IPC, filesystem types, and its archive dependency have been removed. Electron still uses Node path utilities only to resolve packaged renderer assets; it does not expose filesystem browsing to the user.
