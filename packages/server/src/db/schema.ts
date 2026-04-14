import { sqliteTable, text, integer, uniqueIndex, real } from 'drizzle-orm/sqlite-core';

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),            // YYYY-MM-DD
  note: text('note'),
  createdAt: text('created_at').notNull(),  // ISO datetime
});

export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull(),
  categoryId: text('category_id').notNull(),
  type: text('type', { enum: ['asset', 'liability'] }).notNull(),
  name: text('name').notNull(),
  value: integer('value').notNull(), // cents; positive for assets, negative for liabilities
});

// ── Todo App Tables ──

export const todoGroups = sqliteTable('todo_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => todoGroups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
  status: text('status', { enum: ['open', 'completed'] }).notNull().default('open'),
  dueDate: text('due_date'),
  recurrence: text('recurrence'),          // JSON-stringified RecurrenceRule
  parentId: text('parent_id'),             // self-referencing FK for subtasks
  sortOrder: integer('sort_order').notNull().default(0),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const recurringCompletions = sqliteTable('recurring_completions', {
  id: text('id').primaryKey(),
  todoId: text('todo_id')
    .notNull()
    .references(() => todos.id, { onDelete: 'cascade' }),
  completionDate: text('completion_date').notNull(),
  completedAt: text('completed_at').notNull(),
}, (table) => ([
  uniqueIndex('idx_recurring_todo_date').on(table.todoId, table.completionDate),
]));

// ── Stocks App Tables ──

export const stocks = sqliteTable('stocks', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  companyName: text('company_name').notNull(),
  exchange: text('exchange'),
  sector: text('sector'),
  industry: text('industry'),
  trackingMode: text('tracking_mode', { enum: ['watchlist', 'holding', 'both'] }).notNull().default('watchlist'),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  thesis: text('thesis'),
  notesHtml: text('notes_html'),
  sharesMilli: integer('shares_milli'),
  averageCostBasis: integer('average_cost_basis'),
  conviction: text('conviction'),
  manualTargetPrice: integer('manual_target_price'),
  manualCurrentPrice: integer('manual_current_price'),
  manualPeRatio: real('manual_pe_ratio'),
  manualPbRatio: real('manual_pb_ratio'),
  manualPsRatio: real('manual_ps_ratio'),
  manualEpsGrowth: real('manual_eps_growth'),
  lastManualUpdateAt: text('last_manual_update_at'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ([
  uniqueIndex('idx_stocks_symbol').on(table.symbol),
]));

export const stockMetricsCache = sqliteTable('stock_metrics_cache', {
  id: text('id').primaryKey(),
  stockId: text('stock_id')
    .notNull()
    .references(() => stocks.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('alpha-vantage'),
  refreshState: text('refresh_state', { enum: ['never', 'fresh', 'stale', 'error'] }).notNull().default('never'),
  openPrice: integer('open_price'),
  highPrice: integer('high_price'),
  lowPrice: integer('low_price'),
  currentPrice: integer('current_price'),
  previousClosePrice: integer('previous_close_price'),
  priceChange: integer('price_change'),
  priceChangePercent: real('price_change_percent'),
  analystTargetPrice: integer('analyst_target_price'),
  volume: integer('volume'),
  latestTradingDay: text('latest_trading_day'),
  peRatio: real('pe_ratio'),
  pbRatio: real('pb_ratio'),
  psRatio: real('ps_ratio'),
  epsGrowth: real('eps_growth'),
  marketCap: real('market_cap'),
  beta: real('beta'),
  fiftyTwoWeekHigh: integer('fifty_two_week_high'),
  fiftyTwoWeekLow: integer('fifty_two_week_low'),
  fiftyDayMovingAverage: integer('fifty_day_moving_average'),
  twoHundredDayMovingAverage: integer('two_hundred_day_moving_average'),
  dividendYield: real('dividend_yield'),
  profitMargin: real('profit_margin'),
  operatingMarginTtm: real('operating_margin_ttm'),
  returnOnAssetsTtm: real('return_on_assets_ttm'),
  returnOnEquityTtm: real('return_on_equity_ttm'),
  quarterlyEarningsGrowthYoy: real('quarterly_earnings_growth_yoy'),
  quarterlyRevenueGrowthYoy: real('quarterly_revenue_growth_yoy'),
  sharesOutstanding: real('shares_outstanding'),
  revenueTtm: real('revenue_ttm'),
  grossProfitTtm: real('gross_profit_ttm'),
  analystRating: text('analyst_rating'),
  fetchedAt: text('fetched_at'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ([
  uniqueIndex('idx_stock_metrics_stock').on(table.stockId),
]));

export const stockVersions = sqliteTable('stock_versions', {
  id: text('id').primaryKey(),
  stockId: text('stock_id')
    .notNull()
    .references(() => stocks.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['manual', 'api-refresh', 'restore'] }).notNull().default('manual'),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(),
});
