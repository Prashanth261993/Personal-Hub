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
  forwardPe: number | null;
  pegRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  ebitda: number | null;                // USD
  bookValue: number | null;             // cents (per share)
  dilutedEpsTtm: number | null;         // cents (per share)
  dividendPerShare: number | null;      // cents (per share)
  exDividendDate: string | null;        // YYYY-MM-DD
  dividendDate: string | null;          // YYYY-MM-DD
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
  analystRatingStrongBuy: number | null;   // analyst count
  analystRatingBuy: number | null;
  analystRatingHold: number | null;
  analystRatingSell: number | null;
  analystRatingStrongSell: number | null;
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
  plaidAccountId: string | null;
  syncSource: 'manual' | 'plaid' | null;
  lastPlaidSyncAt: string | null;
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
  forwardPe: number | null;
  pegRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  ebitda: number | null;                // USD
  bookValue: number | null;             // cents (per share)
  dilutedEpsTtm: number | null;         // cents (per share)
  dividendPerShare: number | null;      // cents (per share)
  exDividendDate: string | null;
  dividendDate: string | null;
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
  analystRatingStrongBuy: number | null;
  analystRatingBuy: number | null;
  analystRatingHold: number | null;
  analystRatingSell: number | null;
  analystRatingStrongSell: number | null;
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
  /** Point-in-time snapshot of the effective metrics when this version was written.
   *  Optional because versions created before this field existed will not have it. */
  metrics?: StockMetricsSnapshot | null;
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

// ── Plaid / Brokerage Types ──

export interface PlaidConnection {
  id: string;
  institutionName: string;
  institutionId: string;
  accountsJson: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export type StockTransactionType = 'buy' | 'sell' | 'dividend' | 'transfer' | 'fee';

export interface StockTransaction {
  id: string;
  stockId: string;
  connectionId: string | null;
  type: StockTransactionType;
  date: string;                   // YYYY-MM-DD
  quantity: number;
  priceCents: number;             // price per share in cents
  amountCents: number;            // total amount in cents
  feesCents: number;
  createdAt: string;
}

export interface StockLot {
  id: string;
  stockId: string;
  connectionId: string | null;
  buyDate: string;                // YYYY-MM-DD
  quantity: number;               // remaining shares (decremented on sell via FIFO)
  originalQuantity: number;       // shares originally purchased
  priceCents: number;             // price per share at purchase in cents
  feesCents: number;
  source: 'plaid' | 'manual';
  createdAt: string;
}

/** Computed per-lot summary for the detail view (not persisted) */
export interface LotSummary {
  id: string;
  buyDate: string;
  quantity: number;
  originalQuantity: number;
  priceCents: number;
  costBasisCents: number;         // quantity × priceCents
  currentValueCents: number;      // quantity × currentPriceCents
  gainLossCents: number;          // currentValueCents - costBasisCents
  gainLossPercent: number;
  holdingDays: number;
  isLongTerm: boolean;            // holdingDays > 365
  source: 'plaid' | 'manual';
}

export interface PlaidSyncResult {
  synced: { symbol: string; shares: number; avgCostBasisCents: number }[];
  skipped: string[];              // symbols in Plaid but not tracked
  errors: string[];
}

/** Preview of a single Plaid holding before sync — user picks which to import */
export interface PlaidHoldingPreview {
  symbol: string;
  name: string;
  shares: number;
  costBasisCents: number | null;
  currentPriceCents: number | null;
  currentValueCents: number | null;
  isTracked: boolean;             // true if symbol exists in stocks table
  accountId: string;
}

/** A single data point in the metrics history time series */
export interface MetricsHistoryPoint {
  date: string;                   // YYYY-MM-DD
  source: string;
  currentPrice: number | null;    // cents
  targetPrice: number | null;     // cents
  peRatio: number | null;
  forwardPe: number | null;
  pegRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  ebitda: number | null;          // USD
  bookValue: number | null;       // cents
  dilutedEpsTtm: number | null;   // cents
  dividendPerShare: number | null;// cents
  epsGrowth: number | null;       // percentage
  marketCap: number | null;       // USD
  beta: number | null;
  dividendYield: number | null;   // percentage
  profitMargin: number | null;    // percentage
  operatingMarginTtm: number | null; // percentage
  returnOnAssetsTtm: number | null;  // percentage
  returnOnEquityTtm: number | null;  // percentage
  sharesOutstanding: number | null;
  revenueTtm: number | null;      // USD
  grossProfitTtm: number | null;  // USD
}

// ── Stocks Agent Types ──

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatRequest {
  messages: AgentMessage[];
}

// ── Funds App Types (SEC 13F) ──

export type FundStatus = 'active' | 'archived';

/** A tracked institutional manager, identified by its SEC CIK. */
export interface Fund {
  id: string;
  cik: string;              // 10-digit zero-padded Central Index Key
  name: string;
  status: FundStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single 13F-HR filing for a fund (one per quarter). */
export interface FundFiling {
  id: string;
  fundId: string;
  accessionNumber: string;  // SEC accession, e.g. 0001067983-25-000012
  periodOfReport: string;   // YYYY-MM-DD (quarter end)
  quarter: string;          // 'YYYY-Q#'
  filedAt: string;          // YYYY-MM-DD
  totalValueCents: number;  // sum of all holding values, in cents
  positionCount: number;
  createdAt: string;
}

/** A single position within a 13F filing's information table. */
export interface FundHolding {
  id: string;
  filingId: string;
  issuerName: string;
  cusip: string;
  ticker: string | null;        // best-effort mapping (Phase 2)
  stockId: string | null;       // cross-link to stocks table (Phase 2)
  valueCents: number;
  shares: number;
  putCall: string | null;       // 'Put' | 'Call' | null
  pctOfPortfolio: number;       // value / filing total × 100
  createdAt: string;
}

/** Dashboard row: a fund with a summary of its latest filing. */
export interface FundsDashboardRow {
  id: string;
  cik: string;
  name: string;
  status: FundStatus;
  lastSyncedAt: string | null;
  latestQuarter: string | null;
  latestPeriodOfReport: string | null;
  totalValueCents: number | null;
  positionCount: number | null;
  topHoldingName: string | null;
}

export interface FundDetailResponse {
  fund: Fund;
  filings: FundFiling[];
  latestFiling: FundFiling | null;
  holdings: FundHolding[];      // holdings for latestFiling (or empty)
}

export interface FundsHomeSummary {
  trackedCount: number;
  totalPositions: number;
  refreshedTodayCount: number;
}

export interface RefreshFundResponse {
  fund: Fund;
  filing: FundFiling | null;
  holdingsCount: number;
  message: string;
}

export interface CreateFundRequest {
  cik: string;
  name?: string;
}

export interface UpdateFundRequest {
  name?: string;
  status?: FundStatus;
}

/** Seed entry in config/funds/seed.json */
export interface FundSeedEntry {
  cik: string;
  name: string;
}

export interface FundSeedConfig {
  funds: FundSeedEntry[];
}

// ── Funds App Types: Phase 2 (deltas + cross-link) ──

export type HoldingChangeType = 'new' | 'add' | 'trim' | 'exit' | 'hold';

/** A quarter-over-quarter change for one position (aggregated per CUSIP). */
export interface HoldingDelta {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  changeType: HoldingChangeType;
  fromShares: number;
  toShares: number;
  sharesChange: number;
  sharesChangePercent: number | null; // null when fromShares is 0 (new position)
  fromValueCents: number;
  toValueCents: number;
  valueChangeCents: number;
  toPctOfPortfolio: number;
}

export interface FundDeltasResponse {
  fromFiling: FundFiling | null;
  toFiling: FundFiling | null;
  deltas: HoldingDelta[];
}

/** Map a 13F holding to a tracked stock (manual confirmation). */
export interface LinkHoldingRequest {
  stockId?: string;
  ticker?: string;
}

// ── Funds App Types: Phase 3 (cross-fund screener) ──

/** Overall directional stance of a position once puts are treated as bearish. */
export type PositionSentiment = 'bullish' | 'bearish' | 'mixed' | 'neutral';

export interface ScreenerFundRef {
  fundId: string;
  fundName: string;
  valueCents: number;            // total exposure (bullish + bearish), absolute
  pctOfPortfolio: number;
  bullishValueCents: number;     // shares + calls
  bearishValueCents: number;     // puts
  changeType: HoldingChangeType | null;   // QoQ vs this fund's prior filing
  sharesChangePercent: number | null;     // null when new or no prior filing
  valueChangeCents: number | null;         // QoQ value delta (null when no prior filing)
}

/** Fundamental metrics, populated only for tracked stocks (else null fields). */
export interface ScreenerMetrics {
  currentPriceCents: number | null;
  targetPriceCents: number | null;
  upsidePct: number | null;      // (target - current) / current × 100
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  epsGrowth: number | null;
  marketCap: number | null;
  beta: number | null;
}

/** One issuer aggregated across the latest filing of every tracked fund. */
export interface ScreenerRow {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  isTracked: boolean;
  fundCount: number;
  totalValueCents: number;       // bullish + bearish across funds
  bullishValueCents: number;     // shares + calls across funds
  bearishValueCents: number;     // puts across funds
  sentiment: PositionSentiment;
  avgPctOfPortfolio: number;     // avg of total pct across holding funds
  convictionPct: number;         // avg long-share (bullish) pct only
  // QoQ aggregates (computed on the fly from each fund's latest two filings)
  fundsNew: number;
  fundsAdded: number;
  fundsTrimmed: number;
  fundsExited: number;
  fundsHold: number;
  maxSharesChangePercent: number | null;  // largest single-fund stake increase (%)
  maxValueChangeCents: number | null;      // largest single-fund stake increase ($)
  netSharesChangePercent: number | null;  // aggregate share change across funds
  metrics: ScreenerMetrics | null;        // null for untracked securities
  funds: ScreenerFundRef[];
}

export interface FundsScreenerResponse {
  rows: ScreenerRow[];
}

// ── Funds App Types: CUSIP → Ticker mappings ──

/** An unmapped 13F security (no ticker resolved yet), aggregated across all funds/filings. */
export interface UnmappedSecurity {
  cusip: string;
  issuerName: string;
  holdingCount: number;     // raw fund_holdings rows referencing this cusip
  fundCount: number;        // distinct funds holding it
  totalValueCents: number;  // summed across the latest reference (best-effort)
}

/** An existing CUSIP → ticker mapping (cusip_map row) with a sample issuer name. */
export interface CusipMapping {
  cusip: string;
  ticker: string;
  source: 'auto' | 'manual';
  updatedAt: string;
  issuerName: string | null;  // representative issuer name from holdings, if any
  stockId: string | null;     // linked tracked stock, if any
}

export interface FundsMappingsResponse {
  unmapped: UnmappedSecurity[];
  mapped: CusipMapping[];
}

/** Create/update a CUSIP → ticker mapping from the mapping page. */
export interface UpsertMappingRequest {
  cusip: string;
  ticker: string;
}

// ── Funds App Types: screener presets ──

export interface FundScreenerRangeFilter {
  min: string;
  max: string;
}

export type FundPositionTypeFilter = 'all' | 'shares' | 'calls' | 'puts';
export type FundSentimentFilter = 'all' | PositionSentiment;

export interface FundScreenerFilters {
  search?: string;
  minFunds?: number;
  trackedOnly?: boolean;
  sentiment?: FundSentimentFilter;
  positionType?: FundPositionTypeFilter;
  minStakeIncreasePct?: string;   // largest single-fund increase ≥ this %
  upsidePct?: FundScreenerRangeFilter;
  peRatio?: FundScreenerRangeFilter;
  pbRatio?: FundScreenerRangeFilter;
  psRatio?: FundScreenerRangeFilter;
  epsGrowth?: FundScreenerRangeFilter;
  marketCap?: FundScreenerRangeFilter;
}

export interface FundScreenerPreset {
  id: string;
  label: string;
  description: string;
  builtIn: boolean;
  filters: FundScreenerFilters;
  sortKey: string;
  createdAt: string;
}

export interface FundScreenerPresetsConfig {
  presets: FundScreenerPreset[];
}

// ── Funds App Types: Insights (cross-fund signals) ──

/** One fund's move on a security, used inside consensus groupings. */
export interface FundMoveRef {
  fundId: string;
  fundName: string;
  changeType: HoldingChangeType;
  sharesChangePercent: number | null;
  valueChangeCents: number | null;   // QoQ value delta (null when no prior filing)
  toValueCents: number;
  toPctOfPortfolio: number;
}

/** A security that multiple funds moved the same direction on this quarter. */
export interface ConsensusMove {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  isTracked: boolean;
  fundCount: number;
  totalValueCents: number;     // sum of toValueCents across the listed funds
  funds: FundMoveRef[];
}

/** A single fund's high-conviction (large % of portfolio) position. */
export interface ConcentratedBet {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  fundId: string;
  fundName: string;
  pctOfPortfolio: number;
  valueCents: number;
  sentiment: PositionSentiment;
}

/** Put (bearish) exposure on a security across funds. */
export interface BearishSignal {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  fundCount: number;
  putValueCents: number;
  funds: { fundId: string; fundName: string; putValueCents: number }[];
}

export interface FundsInsightsResponse {
  quarterLabel: string | null;     // representative latest quarter across funds
  clusterBuys: ConsensusMove[];    // new or added by ≥2 funds
  newConsensus: ConsensusMove[];   // brand-new positions in ≥2 funds
  clusterExits: ConsensusMove[];   // exited or trimmed by ≥2 funds
  bearishActivity: BearishSignal[];
  concentratedBets: ConcentratedBet[];
  trackedOverlap: ConsensusMove[]; // any fund move on a tracked stock
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
