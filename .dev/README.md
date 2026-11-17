# Simple Docs — Developer Guide

This folder is the development source of truth for maintaining Simple Docs.

- architecture.md — renderer, preload, IPC, and SQLite boundaries.
- development.md — local run, validation, and development workflow.
- source-files.md — source file responsibilities.
- code-changes.md — engineering rules for Library changes.
- production.md — Windows packaging and updater flow.

Core architecture:

```text
React UI
   ↓
typed desktop API
   ↓
restricted preload / IPC
   ↓
Electron main
   ↓
SQLite Library in app user-data
```

The application manages notes and code in nested Library folders. The legacy real-filesystem Explorer has been removed. User content stays in the app's local data directory and must never be committed to GitHub.
