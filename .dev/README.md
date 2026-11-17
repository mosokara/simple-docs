# Simple Docs — Developer Guide

This folder is the development source of truth for maintaining Simple Docs.

Start with:
- architecture.md — how the application layers communicate.
- development.md — how to run, test, debug, commit, and change the project.
- source-files.md — what every source/config file does and where each important code section belongs.
- code-changes.md — rules for common feature changes and filesystem safety.
- production.md — Windows production build, release, and updater flow.

Core rule:

```text
React UI
   ↓
typed desktop API
   ↓
preload / IPC
   ↓
Electron main
   ├─ SQLite Library (notes + snippets)
   └─ real Windows folders (Files workspace)
```

The Library database lives in Electron app user data. The Files workspace reads selected folders in place. Keep these storage systems separate, and never put user data in GitHub.
