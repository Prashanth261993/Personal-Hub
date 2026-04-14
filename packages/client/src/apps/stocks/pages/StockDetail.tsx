import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCurrency, formatPercent } from '@networth/shared';
import { fetchStock, refreshStock, updateStock } from '../api';
import StockEditor from '../components/StockEditor';
import { useStocksTheme } from '../useStocksTheme';

function formatMetric(value: number | null, prefix = '') {
  return value === null ? '—' : `${prefix}${value.toFixed(1)}`;
}

function formatIntegerMetric(value: number | null) {
  return value === null ? '—' : Math.round(value).toLocaleString();
}

function formatCompactMetric(value: number | null, digits = 1) {
  return value === null
    ? '—'
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: digits }).format(value);
}

export default function StockDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { themeClassName } = useStocksTheme();
  const stockId = params.id as string;

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', stockId],
    queryFn: () => fetchStock(stockId),
    enabled: Boolean(stockId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateStock>[1]) => updateStock(stockId, payload),
    meta: { successMessage: 'Stock saved' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', stockId] });
      queryClient.invalidateQueries({ queryKey: ['stocks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-summary'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshStock(stockId),
    meta: { successMessage: 'Metrics refreshed' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', stockId] });
      queryClient.invalidateQueries({ queryKey: ['stocks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-summary'] });
    },
  });

  if (isLoading || !stock) {
    return <div className={`stocks-shell ${themeClassName}`}><div className="stocks-panel text-center py-16 text-[var(--stocks-text-muted)]">Loading stock record...</div></div>;
  }

  return (
    <div className={`stocks-shell ${themeClassName} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/stocks')} className="stocks-link-button mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <p className="stocks-eyebrow">{stock.symbol}</p>
          <h1 className="stocks-title">{stock.companyName}</h1>
          <p className="stocks-subtitle">Every save creates a version. API refreshes update the cache without blocking your manual thesis work.</p>
        </div>
        <div className="stocks-mini-meta">
          <span><Clock3 className="w-4 h-4" /> Updated {new Date(stock.updatedAt).toLocaleString()}</span>
          <span><RefreshCw className="w-4 h-4" /> {stock.lastSyncedAt ? `Synced ${new Date(stock.lastSyncedAt).toLocaleString()}` : 'Never synced'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="stocks-panel">
            <p className="stocks-eyebrow">Effective Metrics</p>
            <h2 className="stocks-panel-title">Trading Tape</h2>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="stocks-metric-tile"><span>Current</span><strong>{stock.effectiveMetrics.currentPrice !== null ? formatCurrency(stock.effectiveMetrics.currentPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Open</span><strong>{stock.effectiveMetrics.openPrice !== null ? formatCurrency(stock.effectiveMetrics.openPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Day High</span><strong>{stock.effectiveMetrics.highPrice !== null ? formatCurrency(stock.effectiveMetrics.highPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Day Low</span><strong>{stock.effectiveMetrics.lowPrice !== null ? formatCurrency(stock.effectiveMetrics.lowPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Prev Close</span><strong>{stock.effectiveMetrics.previousClosePrice !== null ? formatCurrency(stock.effectiveMetrics.previousClosePrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Change</span><strong>{stock.effectiveMetrics.priceChange !== null ? formatCurrency(stock.effectiveMetrics.priceChange) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Change %</span><strong>{stock.effectiveMetrics.priceChangePercent !== null ? formatPercent(stock.effectiveMetrics.priceChangePercent) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Volume</span><strong>{formatIntegerMetric(stock.effectiveMetrics.volume)}</strong></div>
              <div className="stocks-metric-tile"><span>Latest Day</span><strong>{stock.effectiveMetrics.latestTradingDay ?? '—'}</strong></div>
            </div>
          </div>

          <div className="stocks-panel">
            <p className="stocks-eyebrow">Valuation Lens</p>
            <h2 className="stocks-panel-title">Multiples And Range</h2>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="stocks-metric-tile"><span>Target</span><strong>{stock.effectiveMetrics.analystTargetPrice !== null ? formatCurrency(stock.effectiveMetrics.analystTargetPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Upside</span><strong>{stock.upsidePercent !== null ? formatPercent(stock.upsidePercent) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Position Value</span><strong>{stock.positionValue !== null ? formatCurrency(stock.positionValue) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Market Cap</span><strong>{formatCompactMetric(stock.effectiveMetrics.marketCap)}</strong></div>
              <div className="stocks-metric-tile"><span>P/E</span><strong>{formatMetric(stock.effectiveMetrics.peRatio)}</strong></div>
              <div className="stocks-metric-tile"><span>P/B</span><strong>{formatMetric(stock.effectiveMetrics.pbRatio)}</strong></div>
              <div className="stocks-metric-tile"><span>P/S</span><strong>{formatMetric(stock.effectiveMetrics.psRatio)}</strong></div>
              <div className="stocks-metric-tile"><span>Beta</span><strong>{formatMetric(stock.effectiveMetrics.beta)}</strong></div>
              <div className="stocks-metric-tile"><span>52W High</span><strong>{stock.effectiveMetrics.fiftyTwoWeekHigh !== null ? formatCurrency(stock.effectiveMetrics.fiftyTwoWeekHigh) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>52W Low</span><strong>{stock.effectiveMetrics.fiftyTwoWeekLow !== null ? formatCurrency(stock.effectiveMetrics.fiftyTwoWeekLow) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>50D Avg</span><strong>{stock.effectiveMetrics.fiftyDayMovingAverage !== null ? formatCurrency(stock.effectiveMetrics.fiftyDayMovingAverage) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>200D Avg</span><strong>{stock.effectiveMetrics.twoHundredDayMovingAverage !== null ? formatCurrency(stock.effectiveMetrics.twoHundredDayMovingAverage) : '—'}</strong></div>
            </div>
          </div>

          <div className="stocks-panel">
            <p className="stocks-eyebrow">Business Quality</p>
            <h2 className="stocks-panel-title">Growth And Returns</h2>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="stocks-metric-tile"><span>EPS Growth</span><strong>{stock.effectiveMetrics.epsGrowth !== null ? formatPercent(stock.effectiveMetrics.epsGrowth) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Revenue Growth</span><strong>{stock.effectiveMetrics.quarterlyRevenueGrowthYoy !== null ? formatPercent(stock.effectiveMetrics.quarterlyRevenueGrowthYoy) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Earnings Growth</span><strong>{stock.effectiveMetrics.quarterlyEarningsGrowthYoy !== null ? formatPercent(stock.effectiveMetrics.quarterlyEarningsGrowthYoy) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Dividend Yield</span><strong>{stock.effectiveMetrics.dividendYield !== null ? formatPercent(stock.effectiveMetrics.dividendYield) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Profit Margin</span><strong>{stock.effectiveMetrics.profitMargin !== null ? formatPercent(stock.effectiveMetrics.profitMargin) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Op Margin</span><strong>{stock.effectiveMetrics.operatingMarginTtm !== null ? formatPercent(stock.effectiveMetrics.operatingMarginTtm) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>ROA</span><strong>{stock.effectiveMetrics.returnOnAssetsTtm !== null ? formatPercent(stock.effectiveMetrics.returnOnAssetsTtm) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>ROE</span><strong>{stock.effectiveMetrics.returnOnEquityTtm !== null ? formatPercent(stock.effectiveMetrics.returnOnEquityTtm) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Shares Out</span><strong>{formatCompactMetric(stock.effectiveMetrics.sharesOutstanding)}</strong></div>
              <div className="stocks-metric-tile"><span>Revenue TTM</span><strong>{formatCompactMetric(stock.effectiveMetrics.revenueTtm)}</strong></div>
              <div className="stocks-metric-tile"><span>Gross Profit</span><strong>{formatCompactMetric(stock.effectiveMetrics.grossProfitTtm)}</strong></div>
            </div>
          </div>
      </div>

      <StockEditor
        stock={stock}
        saving={updateMutation.isPending}
        refreshing={refreshMutation.isPending}
        onSave={(payload) => updateMutation.mutate(payload)}
        onRefresh={async () => { await refreshMutation.mutateAsync(); }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stocks-panel">
          <p className="stocks-eyebrow">Version History</p>
          <h2 className="stocks-panel-title">Save Timeline</h2>
          <div className="space-y-3 mt-5">
            {stock.history.map((version) => (
              <div key={version.id} className="stocks-history-item">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--stocks-text-strong)]">{version.source}</p>
                    <p className="text-xs text-[var(--stocks-text-muted)]">{new Date(version.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="stocks-badge">{version.payload.trackingMode}</span>
                </div>
                <p className="text-sm text-[var(--stocks-text-muted)] mt-2 line-clamp-2">{version.payload.thesis || 'No thesis captured in this version.'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}