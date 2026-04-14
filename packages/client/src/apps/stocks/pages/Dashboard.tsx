import { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, ChevronDown, ChevronUp, CirclePlus, Clock3, Filter, Plus, RefreshCw, Search,
  SlidersHorizontal, Trash2, TrendingDown, TrendingUp, WalletCards, Eye, X, Zap,
} from 'lucide-react';
import type { StockDashboardRow, StockPreset, StockPresetFilters } from '@networth/shared';
import { createStockPreset, deleteStockPreset, fetchStockPresets, fetchStocksDashboard } from '../api';
import { formatCurrency, formatPercent } from '@networth/shared';
import { useStocksTheme } from '../useStocksTheme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TrackingFilter = 'all' | 'watchlist' | 'holding';

type SortField =
  | 'upsidePercent' | 'peRatio' | 'epsGrowth' | 'marketCap'
  | 'positionValue' | 'currentPrice' | 'beta' | 'dividendYield'
  | 'profitMargin' | 'returnOnEquityTtm' | 'updatedAt' | 'lastSyncedAt' | 'companyName';

type SortDirection = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  direction: SortDirection;
  label: string;
}

interface RangeFilter {
  min: string;
  max: string;
}

interface AdvancedFilters {
  upsidePercent: RangeFilter;
  peRatio: RangeFilter;
  pbRatio: RangeFilter;
  epsGrowth: RangeFilter;
  dividendYield: RangeFilter;
  marketCap: RangeFilter;
  beta: RangeFilter;
  profitMargin: RangeFilter;
  returnOnEquityTtm: RangeFilter;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS: SortOption[] = [
  { field: 'upsidePercent', direction: 'desc', label: 'Upside % — highest first' },
  { field: 'upsidePercent', direction: 'asc', label: 'Upside % — lowest first (overvalued)' },
  { field: 'peRatio', direction: 'asc', label: 'P/E — cheapest earnings' },
  { field: 'peRatio', direction: 'desc', label: 'P/E — most expensive' },
  { field: 'epsGrowth', direction: 'desc', label: 'EPS Growth — fastest' },
  { field: 'marketCap', direction: 'desc', label: 'Market Cap — largest' },
  { field: 'positionValue', direction: 'desc', label: 'Position Value — biggest' },
  { field: 'currentPrice', direction: 'desc', label: 'Price — highest' },
  { field: 'currentPrice', direction: 'asc', label: 'Price — lowest' },
  { field: 'beta', direction: 'desc', label: 'Beta — most volatile' },
  { field: 'beta', direction: 'asc', label: 'Beta — most defensive' },
  { field: 'dividendYield', direction: 'desc', label: 'Dividend Yield — highest' },
  { field: 'profitMargin', direction: 'desc', label: 'Profit Margin — highest' },
  { field: 'returnOnEquityTtm', direction: 'desc', label: 'ROE — highest' },
  { field: 'updatedAt', direction: 'desc', label: 'Recently Updated' },
  { field: 'lastSyncedAt', direction: 'asc', label: 'Last Synced — oldest first' },
  { field: 'lastSyncedAt', direction: 'desc', label: 'Last Synced — newest first' },
  { field: 'companyName', direction: 'asc', label: 'Company Name A→Z' },
];

const EMPTY_RANGE: RangeFilter = { min: '', max: '' };

const EMPTY_ADVANCED: AdvancedFilters = {
  upsidePercent: EMPTY_RANGE,
  peRatio: EMPTY_RANGE,
  pbRatio: EMPTY_RANGE,
  epsGrowth: EMPTY_RANGE,
  dividendYield: EMPTY_RANGE,
  marketCap: EMPTY_RANGE,
  beta: EMPTY_RANGE,
  profitMargin: EMPTY_RANGE,
  returnOnEquityTtm: EMPTY_RANGE,
};

const RANGE_FIELD_LABELS: Record<keyof AdvancedFilters, string> = {
  upsidePercent: 'Upside %',
  peRatio: 'P/E',
  pbRatio: 'P/B',
  epsGrowth: 'EPS Growth %',
  dividendYield: 'Div Yield %',
  marketCap: 'Market Cap ($)',
  beta: 'Beta',
  profitMargin: 'Profit Margin %',
  returnOnEquityTtm: 'ROE %',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMetric(value: number | null, prefix = ''): string {
  return value === null ? '—' : `${prefix}${value.toFixed(1)}`;
}

function getMetricValue(row: StockDashboardRow, field: SortField): number | string | null {
  switch (field) {
    case 'upsidePercent': return row.upsidePercent;
    case 'positionValue': return row.positionValue;
    case 'currentPrice': return row.metrics.currentPrice;
    case 'peRatio': return row.metrics.peRatio;
    case 'epsGrowth': return row.metrics.epsGrowth;
    case 'marketCap': return row.metrics.marketCap;
    case 'beta': return row.metrics.beta;
    case 'dividendYield': return row.metrics.dividendYield;
    case 'profitMargin': return row.metrics.profitMargin;
    case 'returnOnEquityTtm': return row.metrics.returnOnEquityTtm;
    case 'updatedAt': return row.stock.updatedAt;
    case 'lastSyncedAt': return row.lastFetchedAt;
    case 'companyName': return row.stock.companyName;
  }
}

function compareRows(a: StockDashboardRow, b: StockDashboardRow, field: SortField, direction: SortDirection): number {
  const av = getMetricValue(a, field);
  const bv = getMetricValue(b, field);

  if (av === null && bv === null) return 0;
  if (av === null) return 1;   // nulls always last
  if (bv === null) return -1;

  if (typeof av === 'string' && typeof bv === 'string') {
    return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  }

  const diff = (av as number) - (bv as number);
  return direction === 'asc' ? diff : -diff;
}

function parseRange(r: RangeFilter): { min: number | null; max: number | null } {
  const min = r.min.trim() ? Number(r.min) : null;
  const max = r.max.trim() ? Number(r.max) : null;
  return {
    min: min !== null && Number.isFinite(min) ? min : null,
    max: max !== null && Number.isFinite(max) ? max : null,
  };
}

function passesRange(value: number | null, range: RangeFilter): boolean {
  const { min, max } = parseRange(range);
  if (min === null && max === null) return true;
  if (value === null) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function countActiveFilters(af: AdvancedFilters): number {
  return (Object.keys(af) as (keyof AdvancedFilters)[]).reduce((count, key) => {
    const { min, max } = parseRange(af[key]);
    return count + (min !== null || max !== null ? 1 : 0);
  }, 0);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { theme, setTheme, themeClassName } = useStocksTheme();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stocks-dashboard'],
    queryFn: fetchStocksDashboard,
  });
  const { data: presets = [] } = useQuery({
    queryKey: ['stock-presets'],
    queryFn: fetchStockPresets,
  });

  const createPresetMutation = useMutation({
    mutationFn: createStockPreset,
    meta: { successMessage: 'Preset saved' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-presets'] }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: deleteStockPreset,
    meta: { successMessage: 'Preset deleted' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-presets'] }),
  });

  // --- state ---
  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortIndex, setSortIndex] = useState(0); // index into SORT_OPTIONS
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // derived
  const activeSort = SORT_OPTIONS[sortIndex];
  const activeFilterCount = countActiveFilters(advancedFilters);

  const sectors = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.rows.forEach((r) => { if (r.stock.sector) set.add(r.stock.sector); });
    return [...set].sort();
  }, [data]);

  const clearAll = useCallback(() => {
    setTrackingFilter('all');
    setSearchQuery('');
    setSortIndex(0);
    setSectorFilter('all');
    setAdvancedFilters(EMPTY_ADVANCED);
    setShowAdvanced(false);
  }, []);

  const applyPreset = useCallback((preset: StockPreset) => {
    const next = { ...EMPTY_ADVANCED };
    for (const [k, v] of Object.entries(preset.filters)) {
      if (v) next[k as keyof AdvancedFilters] = v as RangeFilter;
    }
    setAdvancedFilters(next);
    setShowAdvanced(true);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = savePresetName.trim();
    if (!name) return;
    const filters: StockPresetFilters = {};
    for (const [k, v] of Object.entries(advancedFilters)) {
      const rf = v as RangeFilter;
      if (rf.min || rf.max) filters[k as keyof StockPresetFilters] = rf;
    }
    createPresetMutation.mutate({ label: name, description: '', filters });
    setSavePresetName('');
    setShowSaveForm(false);
  }, [savePresetName, advancedFilters, createPresetMutation]);

  const setRange = useCallback((field: keyof AdvancedFilters, part: 'min' | 'max', value: string) => {
    setAdvancedFilters((prev) => ({
      ...prev,
      [field]: { ...prev[field], [part]: value },
    }));
  }, []);

  // --- pipeline: search → filter → sort ---
  const rows = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const sort = SORT_OPTIONS[sortIndex];

    return data.rows
      .filter((row) => {
        // tracking mode
        if (trackingFilter === 'watchlist' && row.stock.trackingMode !== 'watchlist' && row.stock.trackingMode !== 'both') return false;
        if (trackingFilter === 'holding' && row.stock.trackingMode !== 'holding' && row.stock.trackingMode !== 'both') return false;
        // search
        if (q && !row.stock.symbol.toLowerCase().includes(q) && !row.stock.companyName.toLowerCase().includes(q)) return false;
        // sector
        if (sectorFilter !== 'all' && row.stock.sector !== sectorFilter) return false;
        // advanced ranges
        if (!passesRange(row.upsidePercent, advancedFilters.upsidePercent)) return false;
        if (!passesRange(row.metrics.peRatio, advancedFilters.peRatio)) return false;
        if (!passesRange(row.metrics.pbRatio, advancedFilters.pbRatio)) return false;
        if (!passesRange(row.metrics.epsGrowth, advancedFilters.epsGrowth)) return false;
        if (!passesRange(row.metrics.dividendYield, advancedFilters.dividendYield)) return false;
        if (!passesRange(row.metrics.marketCap, advancedFilters.marketCap)) return false;
        if (!passesRange(row.metrics.beta, advancedFilters.beta)) return false;
        if (!passesRange(row.metrics.profitMargin, advancedFilters.profitMargin)) return false;
        if (!passesRange(row.metrics.returnOnEquityTtm, advancedFilters.returnOnEquityTtm)) return false;
        return true;
      })
      .sort((a, b) => compareRows(a, b, sort.field, sort.direction));
  }, [data, trackingFilter, searchQuery, sortIndex, sectorFilter, advancedFilters]);

  const totalCount = data?.rows.length ?? 0;
  const hasAnyFilter = searchQuery.trim() !== '' || trackingFilter !== 'all' || sectorFilter !== 'all' || activeFilterCount > 0;

  return (
    <div className={`stocks-shell ${themeClassName}`}>
      <div className="stocks-hero">
        <div>
          <p className="stocks-eyebrow">Stocks</p>
          <h1 className="stocks-title">Opportunity Radar</h1>
          <p className="stocks-subtitle">Track watched names, held positions, valuation drift, and every thesis revision in one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="stocks-ghost-button">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" onClick={() => void refetch()} className="stocks-ghost-button" disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Board
          </button>
          <Link to="/stocks/new" className="stocks-primary-button">
            <CirclePlus className="w-4 h-4" />
            Add Stock
          </Link>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="stocks-panel text-center py-16 text-[var(--stocks-text-muted)]">Loading stocks dashboard...</div>
      ) : (
        <div className="space-y-6">
          {/* summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="stocks-stat-card">
              <div className="stocks-stat-icon bg-emerald-500/12 text-emerald-300"><WalletCards className="w-5 h-5" /></div>
              <p className="stocks-stat-label">Tracked</p>
              <p className="stocks-stat-value">{data.summary.totalTracked}</p>
              <p className="stocks-stat-footnote">{data.summary.holdingsCount} holdings · {data.summary.watchlistCount} watchlist</p>
            </div>
            <div className="stocks-stat-card">
              <div className="stocks-stat-icon bg-cyan-500/12 text-cyan-300"><TrendingUp className="w-5 h-5" /></div>
              <p className="stocks-stat-label">Average Upside</p>
              <p className="stocks-stat-value">{data.summary.averageUpsidePercent !== null ? formatPercent(data.summary.averageUpsidePercent) : '—'}</p>
              <p className="stocks-stat-footnote">Analyst target versus current price</p>
            </div>
            <div className="stocks-stat-card">
              <div className="stocks-stat-icon bg-amber-500/12 text-amber-300"><Eye className="w-5 h-5" /></div>
              <p className="stocks-stat-label">Needs Refresh</p>
              <p className="stocks-stat-value">{data.summary.staleCount}</p>
              <p className="stocks-stat-footnote">Stale, missing, or errored feeds</p>
            </div>
            <div className="stocks-stat-card">
              <div className="stocks-stat-icon bg-fuchsia-500/12 text-fuchsia-300"><ArrowUpRight className="w-5 h-5" /></div>
              <p className="stocks-stat-label">Position Value</p>
              <p className="stocks-stat-value">{formatCurrency(data.summary.totalPositionValue)}</p>
              <p className="stocks-stat-footnote">Using latest effective current price</p>
            </div>
          </div>

          {/* main board */}
          <div className="stocks-panel">
            {/* ---- header row ---- */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="stocks-eyebrow">Main Board</p>
                <h2 className="stocks-panel-title">Tracked Names</h2>
              </div>
              <div className="stocks-filter-bar">
                {(['all', 'watchlist', 'holding'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTrackingFilter(mode)}
                    className={trackingFilter === mode ? 'stocks-filter-active' : 'stocks-filter'}
                  >
                    {mode === 'all' ? 'All' : mode === 'watchlist' ? 'Watchlist' : 'Holdings'}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- toolbar ---- */}
            <div className="stocks-toolbar">
              {/* search */}
              <div className="stocks-search-box">
                <Search className="w-4 h-4 text-[var(--stocks-text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol or company…"
                  className="stocks-search-input"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="stocks-search-clear"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>

              {/* sort */}
              <div className="stocks-sort-wrapper">
                <label className="stocks-sort-label">
                  {activeSort.direction === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  <select
                    value={sortIndex}
                    onChange={(e) => setSortIndex(Number(e.target.value))}
                    className="stocks-sort-select"
                  >
                    {SORT_OPTIONS.map((opt, i) => (
                      <option key={i} value={i}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* sector */}
              {sectors.length > 0 && (
                <div className="stocks-sort-wrapper">
                  <label className="stocks-sort-label">
                    <Filter className="w-3.5 h-3.5" />
                    <select
                      value={sectorFilter}
                      onChange={(e) => setSectorFilter(e.target.value)}
                      className="stocks-sort-select"
                    >
                      <option value="all">All Sectors</option>
                      {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {/* advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className={`stocks-ghost-button text-sm !py-2 !px-3 ${showAdvanced ? 'stocks-filter-active' : ''}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Screen
                {activeFilterCount > 0 && <span className="stocks-filter-count">{activeFilterCount}</span>}
              </button>

              {/* clear all */}
              {hasAnyFilter && (
                <button type="button" onClick={clearAll} className="stocks-ghost-button text-sm !py-2 !px-3">
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* ---- advanced screening panel ---- */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="stocks-screen-panel">
                    {/* presets */}
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--stocks-text-muted)] mb-2">
                        <Zap className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Quick Presets
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {presets.map((preset) => (
                          <span key={preset.id} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className="stocks-preset-chip"
                              title={preset.description ?? preset.label}
                            >
                              {preset.label}
                            </button>
                            {!preset.builtIn && (
                              <button
                                type="button"
                                onClick={() => deletePresetMutation.mutate(preset.id)}
                                className="text-[var(--stocks-text-muted)] hover:text-red-400 transition-colors p-0.5"
                                title="Delete preset"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                        {/* save current screen */}
                        {showSaveForm ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={savePresetName}
                              onChange={(e) => setSavePresetName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                              placeholder="Preset name…"
                              autoFocus
                              className="stocks-range-input !w-32"
                            />
                            <button type="button" onClick={handleSavePreset} className="stocks-preset-chip !px-2" title="Save">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowSaveForm(false); setSavePresetName(''); }}
                              className="text-[var(--stocks-text-muted)] hover:text-[var(--stocks-text-strong)] transition-colors text-xs"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowSaveForm(true)}
                            className="stocks-preset-chip !px-2 opacity-60 hover:opacity-100"
                            title="Save current screen as preset"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* range inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(Object.keys(RANGE_FIELD_LABELS) as (keyof AdvancedFilters)[]).map((field) => {
                        const { min, max } = parseRange(advancedFilters[field]);
                        const active = min !== null || max !== null;
                        return (
                          <div key={field} className={`stocks-range-group ${active ? 'stocks-range-active' : ''}`}>
                            <span className="stocks-range-label">{RANGE_FIELD_LABELS[field]}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Min"
                                value={advancedFilters[field].min}
                                onChange={(e) => setRange(field, 'min', e.target.value)}
                                className="stocks-range-input"
                              />
                              <span className="text-[var(--stocks-text-muted)] text-xs">—</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Max"
                                value={advancedFilters[field].max}
                                onChange={(e) => setRange(field, 'max', e.target.value)}
                                className="stocks-range-input"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- result count ---- */}
            <div className="flex items-center justify-between mt-4 mb-3">
              <p className="text-sm text-[var(--stocks-text-muted)]">
                Showing <strong className="text-[var(--stocks-text-strong)]">{rows.length}</strong>{rows.length !== totalCount ? ` of ${totalCount}` : ''} stocks
                {sortIndex !== 0 && <span className="ml-2 text-[var(--stocks-accent)]">sorted by {activeSort.label.toLowerCase()}</span>}
              </p>
            </div>

            {/* ---- cards grid ---- */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {rows.length === 0 ? (
                <div className="xl:col-span-2 text-center py-12 text-[var(--stocks-text-muted)]">
                  No stocks match your filters.{' '}
                  <button type="button" onClick={clearAll} className="text-[var(--stocks-accent)] underline">Clear all</button>
                </div>
              ) : rows.map((row, index) => (
                <motion.div
                  key={row.stock.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.35 }}
                >
                  <Link to={`/stocks/${row.stock.id}`} className="stocks-card block">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="stocks-ticker">{row.stock.symbol}</span>
                          <span className="stocks-badge">{row.stock.trackingMode}</span>
                          <span className={`stocks-badge ${row.refreshState === 'fresh' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-200 border-amber-500/30 bg-amber-500/10'}`}>{row.refreshState}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--stocks-text-strong)]">{row.stock.companyName}</h3>
                        <p className="text-sm text-[var(--stocks-text-muted)] mt-1">{[row.stock.exchange, row.stock.sector].filter(Boolean).join(' · ') || 'No market metadata yet'}</p>
                      </div>
                      <div className={`stocks-upside ${row.upsidePercent !== null && row.upsidePercent >= 0 ? 'stocks-upside-positive' : 'stocks-upside-negative'}`}>
                        {row.upsidePercent !== null ? formatPercent(row.upsidePercent) : '—'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                      <div className="stocks-metric-tile">
                        <span>Current</span>
                        <strong>{row.metrics.currentPrice !== null ? formatCurrency(row.metrics.currentPrice) : '—'}</strong>
                      </div>
                      <div className="stocks-metric-tile">
                        <span>Target</span>
                        <strong>{row.metrics.analystTargetPrice !== null ? formatCurrency(row.metrics.analystTargetPrice) : '—'}</strong>
                      </div>
                      <div className="stocks-metric-tile">
                        <span>P/E</span>
                        <strong>{formatMetric(row.metrics.peRatio)}</strong>
                      </div>
                      <div className="stocks-metric-tile">
                        <span>EPS Growth</span>
                        <strong>{row.metrics.epsGrowth !== null ? `${row.metrics.epsGrowth.toFixed(1)}%` : '—'}</strong>
                      </div>
                    </div>

                    <div className="stocks-card-footer mt-5">
                      <div className="flex items-center gap-4 text-sm text-[var(--stocks-text-muted)]">
                        <span>P/B {formatMetric(row.metrics.pbRatio)}</span>
                        <span>P/S {formatMetric(row.metrics.psRatio)}</span>
                        <span>{row.positionValue !== null ? `Value ${formatCurrency(row.positionValue)}` : 'No position size'}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{row.lastFetchedAt ? new Date(row.lastFetchedAt).toLocaleDateString() : 'Never synced'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--stocks-accent)]">
                        Open record
                        {row.upsidePercent !== null && row.upsidePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}