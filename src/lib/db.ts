import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const MIGRATIONS: string[] = [
  // 001 — initial schema
  `
  CREATE TABLE households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    inbound_code TEXT NOT NULL UNIQUE,
    ics_token TEXT NOT NULL UNIQUE,
    digest_enabled INTEGER NOT NULL DEFAULT 1,
    allowed_senders TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE people (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    ics_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX people_household ON people(household_id);

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
    person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE invites (
    token TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE captures (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('upload','paste','email')),
    title TEXT NOT NULL,
    text_content TEXT,
    file_path TEXT,
    file_mime TEXT,
    file_name TEXT,
    email_from TEXT,
    doc_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing','done','failed','unverified')),
    error TEXT,
    extractor TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX captures_household ON captures(household_id, created_at);

  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    capture_id TEXT REFERENCES captures(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('event','deadline','task')),
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT,
    all_day INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    notes TEXT,
    needs_prep INTEGER NOT NULL DEFAULT 0,
    prep_note TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    source_quote TEXT,
    status TEXT NOT NULL CHECK (status IN ('proposed','accepted','dismissed')),
    done INTEGER NOT NULL DEFAULT 0,
    assignee_id TEXT REFERENCES people(id) ON DELETE SET NULL,
    accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX items_household_status ON items(household_id, status, start);

  CREATE TABLE item_people (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, person_id)
  );

  CREATE TABLE reminders_sent (
    key TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
];

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`);
  const row = db.prepare(`SELECT MAX(version) AS v FROM _migrations`).get() as { v: number | null };
  const current = row.v ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.prepare(`INSERT INTO _migrations (version) VALUES (?)`).run(i + 1);
    })();
  }
}

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "hearth.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

// Reuse a single connection across hot reloads in dev.
const g = globalThis as unknown as { __hearthDb?: Database.Database };
export const db: Database.Database = g.__hearthDb ?? (g.__hearthDb = open());
