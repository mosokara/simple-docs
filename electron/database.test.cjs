const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const library = require("./database.cjs");
const extraPaths = [];

let userDataPath;

before(() => {
  userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "simple-docs-library-"));
  library.initializeDatabase(userDataPath);
});

after(() => {
  library.closeDatabase();
  fs.rmSync(userDataPath, { recursive: true, force: true });
  for (const extraPath of extraPaths) fs.rmSync(extraPath, { recursive: true, force: true });
});

test("creates, searches, opens, favorites, updates, and deletes a library item", () => {
  const created = library.saveNote({
    title: "Array helpers",
    content: "const values = [1, 2, 3];\nconsole.log(values.map((value) => value * 2));",
    kind: "snippet",
    language: "javascript",
  });

  assert.ok(created.id);
  assert.equal(created.kind, "snippet");
  assert.equal(created.favorite, false);
  assert.equal(created.language, "javascript");

  const searchResults = library.listNotes({ query: "console.log", kind: "snippet" });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, created.id);

  const favorited = library.setFavorite(created.id, true);
  assert.equal(favorited.favorite, true);
  assert.equal(library.listNotes({ favoritesOnly: true }).length, 1);

  const opened = library.touchNote(created.id);
  assert.ok(opened.lastOpenedAt);

  const updated = library.saveNote({
    id: created.id,
    title: "Array helpers updated",
    content: "return values;",
    kind: "snippet",
    language: "javascript",
  });
  assert.equal(updated.id, created.id);
  assert.equal(updated.title, "Array helpers updated");
  assert.equal(updated.content, "return values;");

  assert.equal(library.deleteNote(created.id), true);
  assert.equal(library.getNote(created.id), null);
  assert.equal(library.deleteNote(created.id), false);
});

test("rejects empty titles and non-text content", () => {
  assert.throws(() => library.saveNote({ title: " ", content: "", kind: "note" }), /title is required/i);
  assert.throws(() => library.saveNote({ title: "Valid", content: 42, kind: "note" }), /must be text/i);
});


test("creates nested folders and assigns notes without deleting contents", () => {
  const parent = library.createFolder("JavaScript");
  const child = library.createFolder("React", parent.id);
  const item = library.saveNote({
    title: "useEffect",
    content: "useEffect(() => {}, []);",
    kind: "snippet",
    language: "javascript",
    folderId: child.id,
  });

  assert.equal(item.folderId, child.id);
  assert.equal(library.listNotes({ folderId: child.id })[0].id, item.id);
  assert.equal(library.listFolders().length, 2);
  assert.throws(() => library.deleteFolder(parent.id), /contents/i);

  const renamed = library.renameFolder(child.id, "React Hooks");
  assert.equal(renamed.name, "React Hooks");

  library.deleteNote(item.id);
  assert.equal(library.deleteFolder(child.id), true);
  assert.equal(library.deleteFolder(parent.id), true);
  assert.equal(library.listFolders().length, 0);
});


test("migrates schema-v1 notes into the folder-aware schema without data loss", () => {
  library.closeDatabase();
  const legacyPath = fs.mkdtempSync(path.join(os.tmpdir(), "simple-docs-legacy-"));
  extraPaths.push(legacyPath);
  const legacy = new DatabaseSync(path.join(legacyPath, "simple-docs.sqlite"));
  legacy.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'note',
      language TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      category_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT
    );
    INSERT INTO notes (id, title, content, kind, created_at, updated_at)
    VALUES ('legacy-note', 'Old note', 'Keep this content', 'note', '2026-01-01', '2026-01-02');
    PRAGMA user_version = 1;
  `);
  legacy.close();

  library.initializeDatabase(legacyPath);
  const migrated = library.getNote("legacy-note");
  assert.equal(migrated.title, "Old note");
  assert.equal(migrated.content, "Keep this content");
  assert.equal(migrated.folderId, null);
  assert.equal(library.listFolders().length, 0);
});
