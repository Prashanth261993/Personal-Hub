// ── Config Types (stored as JSON files) ──

export interface FamilyMember {
  id: string;
  name: string;
  color: string; // hex color for charts
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
}

export interface CategoriesConfig {
  assetCategories: Category[];
  liabilityCategories: Category[];
}

export interface FamilyMembersConfig {
  members: FamilyMember[];
}

// ── Database Types (stored in SQLite) ──

export interface Snapshot {
  id: string;
  date: string;       // ISO date string (YYYY-MM-DD)
  note: string | null;
  createdAt: string;   // ISO datetime
}

export interface NetWorthEntry {
  id: string;
  snapshotId: string;
  memberId: string;    // references FamilyMember.id
  categoryId: string;  // references Category.id
  type: 'asset' | 'liability';
  name: string;        // line item label, e.g. "Chase Savings"
  value: number;       // in cents; positive for assets, negative for liabilities
}

// ── API Request/Response Types ──

export interface CreateSnapshotRequest {
  date: string;
  note?: string;
  entries: Omit<NetWorthEntry, 'id' | 'snapshotId'>[];
}

export interface UpdateSnapshotRequest {
  date?: string;
  note?: string;
  entries?: Omit<NetWorthEntry, 'id' | 'snapshotId'>[];
}

export interface SnapshotSummary {
  id: string;
  date: string;
  note: string | null;
  createdAt: string;
  totalAssets: number;       // cents
  totalLiabilities: number;  // cents (negative)
  netWorth: number;          // cents
}

export interface SnapshotDetail extends Snapshot {
  entries: NetWorthEntry[];
}

export interface MemberNetWorth {
  memberId: string;
  memberName: string;
  memberColor: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface TrendDataPoint {
  date: string;
  snapshotId: string;
  combined: number;
  byMember: Record<string, number>; // memberId → netWorth
  byCategory: Record<string, number>; // categoryId → total value
}

export interface InsightsSummary {
  currentNetWorth: number;
  previousNetWorth: number;
  change: number;
  changePercent: number;
  byMember: MemberNetWorth[];
  byCategory: { categoryId: string; categoryName: string; type: 'asset' | 'liability'; total: number }[];
}

export interface Goal {
  id: string;
  name: string;
  targetValue: number;   // cents
  targetDate: string;    // ISO date
  targetType?: 'netWorth' | 'category'; // defaults to 'netWorth'
  categoryId?: string;   // required when targetType === 'category'
  createdAt: string;
}

export interface GoalsConfig {
  goals: Goal[];
}

// ── Todo App Types ──

export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'open' | 'completed';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;            // every N units
  weekdays?: number[];         // 0=Sun..6=Sat (for weekly)
  endDate?: string;            // optional YYYY-MM-DD
  exceptions?: string[];       // dates to skip (YYYY-MM-DD) — used when a recurring instance is detached
}

export interface TodoGroup {
  id: string;
  name: string;
  color: string;               // hex color
  icon: string;                // Lucide icon name
  sortOrder: number;
  createdAt: string;           // ISO datetime
}

export interface Todo {
  id: string;
  groupId: string;
  title: string;
  description: string | null;  // markdown
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string | null;      // YYYY-MM-DD
  recurrence: RecurrenceRule | null;
  parentId: string | null;     // subtask parent
  sortOrder: number;
  completedAt: string | null;  // ISO datetime
  createdAt: string;
  updatedAt: string;
}

export interface TodoSummary {
  id: string;
  groupId: string;
  title: string;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string | null;
  recurrence: RecurrenceRule | null;
  parentId: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtaskCount: number;
  subtaskCompletedCount: number;
}

export interface CreateTodoRequest {
  groupId: string;
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string;
  recurrence?: RecurrenceRule;
  parentId?: string;
}

export interface UpdateTodoRequest {
  groupId?: string;
  title?: string;
  description?: string | null;
  priority?: TodoPriority;
  status?: TodoStatus;
  dueDate?: string | null;
  recurrence?: RecurrenceRule | null;
  sortOrder?: number;
}

export interface MoveTodoRequest {
  groupId: string;
  sortOrder: number;
}

export interface BatchReorderRequest {
  todos: { id: string; sortOrder: number; groupId?: string }[];
}

export interface CreateGroupRequest {
  name: string;
  color: string;
  icon: string;
}

export interface UpdateGroupRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface RecurringCompletion {
  id: string;
  todoId: string;
  completionDate: string;     // YYYY-MM-DD
  completedAt: string;        // ISO datetime
}

export interface TodoStats {
  totalOpen: number;
  totalCompleted: number;
  completedToday: number;
  completedThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  completionsByDay: { date: string; count: number }[];
}

export interface CalendarTodo {
  id: string;
  title: string;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string;
  groupColor: string;
  groupName: string;
  isRecurring: boolean;
  isRecurringInstance?: boolean;  // true when expanded from recurrence
}

// ── Stocks App Types ──

export type StockTrackingMode = 'watchlist' | 'holding' | 'both';
export type StockStatus = 'active' | 'archived';
export type StockVersionSource = 'manual' | 'api-refresh' | 'restore';
export type StockRefreshState = 'never' | 'fresh' | 'stale' | 'error';

export interface StockMetricsSnapshot {
  openPrice: number | null;             // cents
  highPrice: number | null;             // cents
  lowPrice: number | null;              // cents
  currentPrice: number | null;          // cents
  previousClosePrice: number | null;    // cents
  priceChange: number | null;           // cents
  priceChangePercent: number | null;    // percentage
  analystTargetPrice: number | null;    // cents
  volume: number | null;
  latestTradingDay: string | null;      // YYYY-MM-DD
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  epsGrowth: number | null;             // percentage, e.g. 12.4
  marketCap: number | null;             // USD
  beta: number | null;
  fiftyTwoWeekHigh: number | null;      // cents
  fiftyTwoWeekLow: number | null;       // cents
  fiftyDayMovingAverage: number | null; // cents
  twoHundredDayMovingAverage: number | null; // cents
  dividendYield: number | null;         // percentage
  profitMargin: number | null;          // percentage
  operatingMarginTtm: number | null;    // percentage
  returnOnAssetsTtm: number | null;     // percentage
  returnOnEquityTtm: number | null;     // percentage
  quarterlyEarningsGrowthYoy: number | null; // percentage
  quarterlyRevenueGrowthYoy: number | null;  // percentage
  sharesOutstanding: number | null;
  revenueTtm: number | null;            // USD
  grossProfitTtm: number | null;        // USD
}

export interface Stock {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  trackingMode: StockTrackingMode;
  status: StockStatus;
  thesis: string | null;
  notesHtml: string | null;
  sharesMilli: number | null;
  averageCostBasis: number | null;      // cents
  conviction: string | null;
  manualTargetPrice: number | null;     // cents
  manualCurrentPrice: number | null;    // cents
  manualPeRatio: number | null;
  manualPbRatio: number | null;
  manualPsRatio: number | null;
  manualEpsGrowth: number | null;       // percentage
  lastManualUpdateAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMetricsCache {
  id: string;
  stockId: string;
  source: 'alpha-vantage';
  refreshState: StockRefreshState;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  currentPrice: number | null;          // cents
  previousClosePrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  analystTargetPrice: number | null;    // cents
  volume: number | null;
  latestTradingDay: string | null;
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  epsGrowth: number | null;             // percentage
  marketCap: number | null;             // USD
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayMovingAverage: number | null;
  twoHundredDayMovingAverage: number | null;
  dividendYield: number | null;
  profitMargin: number | null;
  operatingMarginTtm: number | null;
  returnOnAssetsTtm: number | null;
  returnOnEquityTtm: number | null;
  quarterlyEarningsGrowthYoy: number | null;
  quarterlyRevenueGrowthYoy: number | null;
  sharesOutstanding: number | null;
  revenueTtm: number | null;
  grossProfitTtm: number | null;
  analystRating: string | null;
  fetchedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockLookupResponse {
  symbol: string;
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  analystRating: string | null;
  metrics: StockMetricsSnapshot;
}

export interface StockVersion {
  id: string;
  stockId: string;
  source: StockVersionSource;
  createdAt: string;
  payload: StockVersionPayload;
}

export interface StockVersionPayload {
  symbol: string;
  companyName: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  trackingMode: StockTrackingMode;
  status: StockStatus;
  thesis: string | null;
  notesHtml: string | null;
  sharesMilli: number | null;
  averageCostBasis: number | null;
  conviction: string | null;
  manualTargetPrice: number | null;
  manualCurrentPrice: number | null;
  manualPeRatio: number | null;
  manualPbRatio: number | null;
  manualPsRatio: number | null;
  manualEpsGrowth: number | null;
}

export interface CreateStockRequest {
  symbol: string;
  companyName: string;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  trackingMode: StockTrackingMode;
  status?: StockStatus;
  thesis?: string | null;
  notesHtml?: string | null;
  sharesMilli?: number | null;
  averageCostBasis?: number | null;
  conviction?: string | null;
  manualTargetPrice?: number | null;
  manualCurrentPrice?: number | null;
  manualPeRatio?: number | null;
  manualPbRatio?: number | null;
  manualPsRatio?: number | null;
  manualEpsGrowth?: number | null;
  /** Full metrics snapshot from a lookup — saved to stock_metrics_cache on create */
  initialMetrics?: StockMetricsSnapshot;
  initialAnalystRating?: string | null;
}

export interface UpdateStockRequest extends Partial<CreateStockRequest> {
  refreshSource?: StockVersionSource;
}

export interface StockDashboardRow {
  stock: Stock;
  metrics: StockMetricsSnapshot;
  refreshState: StockRefreshState;
  analystRating: string | null;
  upsidePercent: number | null;
  positionValue: number | null;         // cents
  lastFetchedAt: string | null;
}

export interface StocksDashboardSummary {
  totalTracked: number;
  holdingsCount: number;
  watchlistCount: number;
  averageUpsidePercent: number | null;
  totalPositionValue: number;
  staleCount: number;
}

export interface StocksDashboardResponse {
  summary: StocksDashboardSummary;
  rows: StockDashboardRow[];
}

export interface StockDetail extends Stock {
  metricsCache: StockMetricsCache | null;
  history: StockVersion[];
  effectiveMetrics: StockMetricsSnapshot;
  upsidePercent: number | null;
  positionValue: number | null;
}

export interface RefreshStockResponse {
  stockId: string;
  refreshState: StockRefreshState;
  metricsCache: StockMetricsCache | null;
  message: string;
}

export interface StocksHomeSummary {
  trackedCount: number;
  holdingsCount: number;
  averageUpsidePercent: number | null;
  refreshedTodayCount: number;
}

export interface StockPresetRangeFilter {
  min: string;
  max: string;
}

export interface StockPresetFilters {
  upsidePercent?: StockPresetRangeFilter;
  peRatio?: StockPresetRangeFilter;
  pbRatio?: StockPresetRangeFilter;
  epsGrowth?: StockPresetRangeFilter;
  dividendYield?: StockPresetRangeFilter;
  marketCap?: StockPresetRangeFilter;
  beta?: StockPresetRangeFilter;
  profitMargin?: StockPresetRangeFilter;
  returnOnEquityTtm?: StockPresetRangeFilter;
}

export interface StockPreset {
  id: string;
  label: string;
  description: string;
  builtIn: boolean;
  filters: StockPresetFilters;
  createdAt: string;
}

export interface StockPresetsConfig {
  presets: StockPreset[];
}

// ── Stocks Agent Types ──

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatRequest {
  messages: AgentMessage[];
}

// ── Platform Types ──

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;        // Lucide icon name
  basePath: string;    // e.g. '/networth'
  description: string;
}

// ── Utility ──

/** Convert dollars to cents */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert cents to dollars */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Format cents as a currency string */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`;
}
