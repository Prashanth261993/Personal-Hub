import { sqlite } from './index.js';

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

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

    -- Stocks App Tables
    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      company_name TEXT NOT NULL,
      exchange TEXT,
      sector TEXT,
      industry TEXT,
      tracking_mode TEXT NOT NULL DEFAULT 'watchlist' CHECK(tracking_mode IN ('watchlist', 'holding', 'both')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      thesis TEXT,
      notes_html TEXT,
      shares_milli INTEGER,
      average_cost_basis INTEGER,
      conviction TEXT,
      manual_target_price INTEGER,
      manual_current_price INTEGER,
      manual_pe_ratio REAL,
      manual_pb_ratio REAL,
      manual_ps_ratio REAL,
      manual_eps_growth REAL,
      last_manual_update_at TEXT,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_metrics_cache (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'alpha-vantage',
      refresh_state TEXT NOT NULL DEFAULT 'never' CHECK(refresh_state IN ('never', 'fresh', 'stale', 'error')),
      open_price INTEGER,
      high_price INTEGER,
      low_price INTEGER,
      current_price INTEGER,
      previous_close_price INTEGER,
      price_change INTEGER,
      price_change_percent REAL,
      analyst_target_price INTEGER,
      volume INTEGER,
      latest_trading_day TEXT,
      pe_ratio REAL,
      pb_ratio REAL,
      ps_ratio REAL,
      eps_growth REAL,
      market_cap REAL,
      beta REAL,
      fifty_two_week_high INTEGER,
      fifty_two_week_low INTEGER,
      fifty_day_moving_average INTEGER,
      two_hundred_day_moving_average INTEGER,
      dividend_yield REAL,
      profit_margin REAL,
      operating_margin_ttm REAL,
      return_on_assets_ttm REAL,
      return_on_equity_ttm REAL,
      quarterly_earnings_growth_yoy REAL,
      quarterly_revenue_growth_yoy REAL,
      shares_outstanding REAL,
      revenue_ttm REAL,
      gross_profit_ttm REAL,
      analyst_rating TEXT,
      fetched_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_versions (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'api-refresh', 'restore')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_metrics_stock ON stock_metrics_cache(stock_id);
    CREATE INDEX IF NOT EXISTS idx_stocks_tracking_mode ON stocks(tracking_mode);
    CREATE INDEX IF NOT EXISTS idx_stocks_status ON stocks(status);
    CREATE INDEX IF NOT EXISTS idx_stocks_updated_at ON stocks(updated_at);
    CREATE INDEX IF NOT EXISTS idx_stock_versions_stock ON stock_versions(stock_id);
    CREATE INDEX IF NOT EXISTS idx_stock_versions_created_at ON stock_versions(created_at);
  `);

  ensureColumn('stock_metrics_cache', 'open_price', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'high_price', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'low_price', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'previous_close_price', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'price_change', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'price_change_percent', 'REAL');
  ensureColumn('stock_metrics_cache', 'volume', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'latest_trading_day', 'TEXT');
  ensureColumn('stock_metrics_cache', 'fifty_two_week_high', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'fifty_two_week_low', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'fifty_day_moving_average', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'two_hundred_day_moving_average', 'INTEGER');
  ensureColumn('stock_metrics_cache', 'dividend_yield', 'REAL');
  ensureColumn('stock_metrics_cache', 'profit_margin', 'REAL');
  ensureColumn('stock_metrics_cache', 'operating_margin_ttm', 'REAL');
  ensureColumn('stock_metrics_cache', 'return_on_assets_ttm', 'REAL');
  ensureColumn('stock_metrics_cache', 'return_on_equity_ttm', 'REAL');
  ensureColumn('stock_metrics_cache', 'quarterly_earnings_growth_yoy', 'REAL');
  ensureColumn('stock_metrics_cache', 'quarterly_revenue_growth_yoy', 'REAL');
  ensureColumn('stock_metrics_cache', 'shares_outstanding', 'REAL');
  ensureColumn('stock_metrics_cache', 'revenue_ttm', 'REAL');
  ensureColumn('stock_metrics_cache', 'gross_profit_ttm', 'REAL');
}
