import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CirclePlus, RefreshCw, TrendingDown, TrendingUp, WalletCards, Eye } from 'lucide-react';
import { fetchStocksDashboard } from '../api';
import { formatCurrency, formatPercent } from '@networth/shared';
import { useStocksTheme } from '../useStocksTheme';

type FilterMode = 'all' | 'watchlist' | 'holding';

function formatMetric(value: number | null, prefix = ''): string {
  if (value === null) {
    return '—';
  }

  return `${prefix}${value.toFixed(1)}`;
}

export default function Dashboard() {
  const { theme, setTheme, themeClassName } = useStocksTheme();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stocks-dashboard'],
    queryFn: fetchStocksDashboard,
  });

  const rows = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.rows.filter((row) => {
      if (filterMode === 'all') {
        return true;
      }

      if (filterMode === 'watchlist') {
        return row.stock.trackingMode === 'watchlist' || row.stock.trackingMode === 'both';
      }

      return row.stock.trackingMode === 'holding' || row.stock.trackingMode === 'both';
    });
  }, [data, filterMode]);

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

          <div className="stocks-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <p className="stocks-eyebrow">Main Board</p>
                <h2 className="stocks-panel-title">Tracked Names</h2>
              </div>
              <div className="stocks-filter-bar">
                {(['all', 'watchlist', 'holding'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMode(mode)}
                    className={filterMode === mode ? 'stocks-filter-active' : 'stocks-filter'}
                  >
                    {mode === 'all' ? 'All' : mode === 'watchlist' ? 'Watchlist' : 'Holdings'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {rows.map((row, index) => (
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