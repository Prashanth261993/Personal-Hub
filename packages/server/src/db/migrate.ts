import { sqlite } from './index.js';

/**
 * Run migrations inline — creates tables if they don't exist.
 * This avoids needing a separate migration step for a local dev tool.
 */
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('asset', 'liability')),
      name TEXT NOT NULL,
      value INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_snapshot ON entries(snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_entries_member ON entries(member_id);
    CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
  `);
}
