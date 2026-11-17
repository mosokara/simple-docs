# Production Build and Release

## Local production build

```bash
npm run build
npm run dist
```

The distribution step creates the Windows x64 installer and ZIP artifact.

## Release prerequisites

- typecheck, lint, and tests pass
- Next.js build passes
- packaged installer is installed and tested
- SQLite opens and upgrades a copy of a schema-v1 database
- note/code CRUD, nested folders, keyboard save, and unsaved-change warning are tested
- updater configuration is reviewed

## Release flow

```text
feature branch → checks → PR review → merge main → version bump → tag → GitHub Release
```

Do not publish v2 until the packaged Windows application has been tested against an existing user-data database.

## Packaging and updates

electron-builder creates Windows x64 NSIS + ZIP artifacts. Packaged builds use electron-updater with GitHub Releases. The current build is unsigned.
