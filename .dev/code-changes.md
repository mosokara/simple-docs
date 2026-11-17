# Code Change Rules

## Library data

- Keep SQLite access in `electron/database.cjs`.
- Expose narrow IPC operations through `electron/main.cjs` and `electron/preload.cjs`.
- Keep `types/electron.d.ts` and `lib/desktop-api.ts` synchronized.
- Use parameterized SQL for all user-provided values.
- Use explicit schema-version migrations; never assume `CREATE TABLE IF NOT EXISTS` modifies existing tables.
- Keep notes and folders in the user's app-data database, not in Git.
- Folder deletion must not cascade-delete user notes or nested folders.

## UI

- Reuse existing CSS tokens.
- Keep the sidebar width bounded and persisted locally.
- New items start in edit mode; existing items open in preview mode.
- Preserve Ctrl+S and beforeunload protection when changing editor state.
- Context-menu actions must close the menu after completion.
- Keep the global search in the application header.
