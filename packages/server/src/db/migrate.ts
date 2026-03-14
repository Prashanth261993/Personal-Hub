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

    -- Todo App Tables
    CREATE TABLE IF NOT EXISTS todo_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES todo_groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'completed')),
      due_date TEXT,
      recurrence TEXT,
      parent_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_completions (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      completion_date TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_todos_group ON todos(group_id);
    CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
    CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_todo_date ON recurring_completions(todo_id, completion_date);
  `);
}
