const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

let database = null;

function db() {
  if (!database) throw new Error("The local library database is not initialized.");
  return database;
}

function initializeDatabase(userDataPath) {
  if (database) return database;
  fs.mkdirSync(userDataPath, { recursive: true });
  database = new DatabaseSync(path.join(userDataPath, "simple-docs.sqlite"));
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'snippet')),
      language TEXT, is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
      category_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, color TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_kind ON notes(kind, updated_at DESC);
  `);

  const columns = database.prepare("PRAGMA table_info(notes)").all().map((column) => column.name);
  if (!columns.includes("folder_id")) {
    database.exec("ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL");
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      parent_id TEXT REFERENCES folders(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      UNIQUE(parent_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id, name COLLATE NOCASE);
    PRAGMA user_version = 2;
  `);
  return database;
}

function mapFolder(row) {
  return row ? { id: row.id, name: row.name, parentId: row.parent_id, createdAt: row.created_at } : null;
}

function listFolders() {
  return db().prepare("SELECT * FROM folders ORDER BY name COLLATE NOCASE").all().map(mapFolder);
}

function createFolder(name, parentId = null) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean || clean.length > 80) throw new Error("Folder name must be between 1 and 80 characters.");
  if (/[\\/\\\\\u0000-\u001F]/.test(clean) || clean === "." || clean === "..") throw new Error("Folder name contains invalid characters.");
  if (parentId && !db().prepare("SELECT id FROM folders WHERE id = ?").get(parentId)) throw new Error("Parent folder not found.");
  const id = randomUUID();
  db().prepare("INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)")
    .run(id, clean, parentId, new Date().toISOString());
  return mapFolder(db().prepare("SELECT * FROM folders WHERE id = ?").get(id));
}

function renameFolder(id, name) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean || clean.length > 80 || /[\\/\\\\\u0000-\u001F]/.test(clean)) throw new Error("Enter a valid folder name.");
  const result = db().prepare("UPDATE folders SET name = ? WHERE id = ?").run(clean, id);
  if (!result.changes) throw new Error("Folder not found.");
  return mapFolder(db().prepare("SELECT * FROM folders WHERE id = ?").get(id));
}

function deleteFolder(id) {
  const hasChildren = db().prepare("SELECT 1 FROM folders WHERE parent_id = ? LIMIT 1").get(id);
  const hasItems = db().prepare("SELECT 1 FROM notes WHERE folder_id = ? LIMIT 1").get(id);
  if (hasChildren || hasItems) throw new Error("Move or delete the folder's contents before deleting it.");
  return db().prepare("DELETE FROM folders WHERE id = ?").run(id).changes > 0;
}

function mapNote(row) {
  if (!row) return null;
  const tags = db().prepare(`SELECT tags.name FROM tags INNER JOIN note_tags ON note_tags.tag_id = tags.id WHERE note_tags.note_id = ? ORDER BY tags.name COLLATE NOCASE`).all(row.id).map((item) => item.name);
  return {
    id: row.id, title: row.title, content: row.content, kind: row.kind, language: row.language,
    favorite: Boolean(row.is_favorite), categoryId: row.category_id, folderId: row.folder_id ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at, lastOpenedAt: row.last_opened_at, tags,
  };
}

function listNotes({ query = "", kind = "all", favoritesOnly = false, recentOnly = false, folderId = undefined } = {}) {
  const conditions = [];
  const params = [];
  if (kind === "note" || kind === "snippet") { conditions.push("kind = ?"); params.push(kind); }
  if (favoritesOnly) conditions.push("is_favorite = 1");
  if (folderId !== undefined) { conditions.push("folder_id = ?"); params.push(folderId); }
  if (query.trim()) {
    conditions.push("(title LIKE ? ESCAPE '\\\\' OR content LIKE ? ESCAPE '\\\\')");
    const escaped = query.trim().replace(/[\\%_]/g, "\\\\$&");
    params.push(`%${escaped}%`, `%${escaped}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = recentOnly ? "COALESCE(last_opened_at, updated_at) DESC" : "is_favorite DESC, updated_at DESC";
  return db().prepare(`SELECT * FROM notes ${where} ORDER BY ${order} LIMIT 500`).all(...params).map(mapNote);
}

function getNote(id) { return mapNote(db().prepare("SELECT * FROM notes WHERE id = ?").get(id)); }

function saveNote(input) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new Error("A title is required.");
  if (title.length > 180) throw new Error("The title must be 180 characters or fewer.");
  if (typeof input.content !== "string") throw new Error("Note content must be text.");
  const kind = input.kind === "snippet" ? "snippet" : "note";
  const language = kind === "snippet" && typeof input.language === "string" ? input.language.slice(0, 40) : null;
  const folderId = typeof input.folderId === "string" && input.folderId ? input.folderId : null;
  if (folderId && !db().prepare("SELECT id FROM folders WHERE id = ?").get(folderId)) throw new Error("Target folder not found.");
  const now = new Date().toISOString();
  const existing = input.id ? db().prepare("SELECT id FROM notes WHERE id = ?").get(input.id) : null;
  if (existing) {
    db().prepare("UPDATE notes SET title = ?, content = ?, kind = ?, language = ?, folder_id = ?, updated_at = ? WHERE id = ?")
      .run(title, input.content, kind, language, folderId, now, input.id);
    return getNote(input.id);
  }
  const id = randomUUID();
  db().prepare("INSERT INTO notes (id, title, content, kind, language, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, title, input.content, kind, language, folderId, now, now);
  return getNote(id);
}

function deleteNote(id) { return db().prepare("DELETE FROM notes WHERE id = ?").run(id).changes > 0; }
function setFavorite(id, favorite) {
  db().prepare("UPDATE notes SET is_favorite = ?, updated_at = ? WHERE id = ?").run(favorite ? 1 : 0, new Date().toISOString(), id);
  return getNote(id);
}
function touchNote(id) {
  db().prepare("UPDATE notes SET last_opened_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  return getNote(id);
}
function listCategories() { return db().prepare("SELECT id, name, color FROM categories ORDER BY name COLLATE NOCASE").all(); }
function createCategory(name) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean || clean.length > 40) throw new Error("Category name must be between 1 and 40 characters.");
  const id = randomUUID();
  db().prepare("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)").run(id, clean, new Date().toISOString());
  return { id, name: clean };
}
function closeDatabase() { if (database) { database.close(); database = null; } }

module.exports = { initializeDatabase, listNotes, getNote, saveNote, deleteNote, setFavorite, touchNote, listCategories, createCategory, listFolders, createFolder, renameFolder, deleteFolder, closeDatabase };
