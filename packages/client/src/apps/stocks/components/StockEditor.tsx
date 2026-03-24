import { useEffect, useState } from 'react';
import { Save, RotateCw } from 'lucide-react';
import { formatCurrency, formatPercent } from '@networth/shared';
import type { CreateStockRequest, StockDetail, StockLookupResponse, StockTrackingMode, UpdateStockRequest } from '@networth/shared';
import TiptapEditor from '../../todo/components/TiptapEditor';

interface StockEditorProps {
  stock?: StockDetail | null;
  saving?: boolean;
  refreshing?: boolean;
  onSave: (data: CreateStockRequest | UpdateStockRequest) => void;
  onRefresh?: (symbol: string) => void | Promise<StockLookupResponse | void>;
  lookupPreview?: StockLookupResponse | null;
}

interface StockFormState {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry: string;
  trackingMode: StockTrackingMode;
  status: 'active' | 'archived';
  conviction: string;
  thesis: string;
  notesHtml: string;
  shares: string;
  averageCostBasis: string;
  manualCurrentPrice: string;
  manualTargetPrice: string;
  manualPeRatio: string;
  manualPbRatio: string;
  manualPsRatio: string;
  manualEpsGrowth: string;
}

function toDollars(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toString();
}

function fromDollars(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function fromNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fromShares(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : null;
}

function createInitialState(stock?: StockDetail | null): StockFormState {
  return {
    symbol: stock?.symbol ?? '',
    companyName: stock?.companyName ?? '',
    exchange: stock?.exchange ?? '',
    sector: stock?.sector ?? '',
    industry: stock?.industry ?? '',
    trackingMode: stock?.trackingMode ?? 'watchlist',
    status: stock?.status ?? 'active',
    conviction: stock?.conviction ?? '',
    thesis: stock?.thesis ?? '',
    notesHtml: stock?.notesHtml ?? '',
    shares: stock?.sharesMilli ? (stock.sharesMilli / 1000).toString() : '',
    averageCostBasis: toDollars(stock?.averageCostBasis),
    manualCurrentPrice: toDollars(stock?.manualCurrentPrice),
    manualTargetPrice: toDollars(stock?.manualTargetPrice),
    manualPeRatio: stock?.manualPeRatio?.toString() ?? '',
    manualPbRatio: stock?.manualPbRatio?.toString() ?? '',
    manualPsRatio: stock?.manualPsRatio?.toString() ?? '',
    manualEpsGrowth: stock?.manualEpsGrowth?.toString() ?? '',
  };
}

export default function StockEditor({ stock, saving = false, refreshing = false, onSave, onRefresh, lookupPreview = null }: StockEditorProps) {
  const [form, setForm] = useState<StockFormState>(() => createInitialState(stock));

  useEffect(() => {
    setForm(createInitialState(stock));
  }, [stock]);

  const setField = <K extends keyof StockFormState>(key: K, value: StockFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleRefresh = async () => {
    if (!onRefresh || !form.symbol.trim()) {
      return;
    }

    const result = await onRefresh(form.symbol);

    if (!result || stock) {
      return;
    }

    setForm((current) => ({
      ...current,
      symbol: result.symbol,
      companyName: current.companyName.trim() ? current.companyName : result.companyName ?? current.companyName,
      exchange: current.exchange.trim() ? current.exchange : result.exchange ?? current.exchange,
      sector: current.sector.trim() ? current.sector : result.sector ?? current.sector,
      industry: current.industry.trim() ? current.industry : result.industry ?? current.industry,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSave({
      symbol: form.symbol,
      companyName: form.companyName,
      exchange: form.exchange || null,
      sector: form.sector || null,
      industry: form.industry || null,
      trackingMode: form.trackingMode,
      status: form.status,
      conviction: form.conviction || null,
      thesis: form.thesis || null,
      notesHtml: form.notesHtml || null,
      sharesMilli: fromShares(form.shares),
      averageCostBasis: fromDollars(form.averageCostBasis),
      manualCurrentPrice: fromDollars(form.manualCurrentPrice),
      manualTargetPrice: fromDollars(form.manualTargetPrice),
      manualPeRatio: fromNumber(form.manualPeRatio),
      manualPbRatio: fromNumber(form.manualPbRatio),
      manualPsRatio: fromNumber(form.manualPsRatio),
      manualEpsGrowth: fromNumber(form.manualEpsGrowth),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
      <div className="stocks-panel space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="stocks-eyebrow">Core Profile</p>
            <h2 className="stocks-panel-title">Research Record</h2>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button type="button" onClick={() => void handleRefresh()} className="stocks-ghost-button" disabled={refreshing || !form.symbol.trim()}>
                <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {stock ? 'Refresh API' : 'Fetch from API'}
              </button>
            )}
            <button type="submit" className="stocks-primary-button" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Version'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="stocks-field">
            <span>Symbol</span>
            <input value={form.symbol} onChange={(e) => setField('symbol', e.target.value.toUpperCase())} placeholder="MSFT" required />
          </label>
          <label className="stocks-field">
            <span>Company Name</span>
            <input value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} placeholder="Microsoft" required />
          </label>
          <label className="stocks-field">
            <span>Tracking Mode</span>
            <select value={form.trackingMode} onChange={(e) => setField('trackingMode', e.target.value as StockTrackingMode)}>
              <option value="watchlist">Watchlist</option>
              <option value="holding">Holding</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="stocks-field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setField('status', e.target.value as 'active' | 'archived')}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="stocks-field">
            <span>Exchange</span>
            <input value={form.exchange} onChange={(e) => setField('exchange', e.target.value)} placeholder="NASDAQ" />
          </label>
          <label className="stocks-field">
            <span>Conviction</span>
            <input value={form.conviction} onChange={(e) => setField('conviction', e.target.value)} placeholder="High conviction compounder" />
          </label>
          <label className="stocks-field">
            <span>Sector</span>
            <input value={form.sector} onChange={(e) => setField('sector', e.target.value)} placeholder="Technology" />
          </label>
          <label className="stocks-field">
            <span>Industry</span>
            <input value={form.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="Software - Infrastructure" />
          </label>
        </div>

        {lookupPreview && !stock && (
          <div className="stocks-panel space-y-4">
            <div>
              <p className="stocks-eyebrow">API Preview</p>
              <h3 className="stocks-panel-title">Alpha Vantage Snapshot</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="stocks-metric-tile"><span>Current</span><strong>{lookupPreview.metrics.currentPrice !== null ? formatCurrency(lookupPreview.metrics.currentPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Target</span><strong>{lookupPreview.metrics.analystTargetPrice !== null ? formatCurrency(lookupPreview.metrics.analystTargetPrice) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Change %</span><strong>{lookupPreview.metrics.priceChangePercent !== null ? formatPercent(lookupPreview.metrics.priceChangePercent) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>P/E</span><strong>{lookupPreview.metrics.peRatio !== null ? lookupPreview.metrics.peRatio.toFixed(1) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>P/B</span><strong>{lookupPreview.metrics.pbRatio !== null ? lookupPreview.metrics.pbRatio.toFixed(1) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>P/S</span><strong>{lookupPreview.metrics.psRatio !== null ? lookupPreview.metrics.psRatio.toFixed(1) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>EPS Growth</span><strong>{lookupPreview.metrics.epsGrowth !== null ? formatPercent(lookupPreview.metrics.epsGrowth) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>Revenue Growth</span><strong>{lookupPreview.metrics.quarterlyRevenueGrowthYoy !== null ? formatPercent(lookupPreview.metrics.quarterlyRevenueGrowthYoy) : '—'}</strong></div>
              <div className="stocks-metric-tile"><span>52W Range</span><strong>{lookupPreview.metrics.fiftyTwoWeekLow !== null && lookupPreview.metrics.fiftyTwoWeekHigh !== null ? `${formatCurrency(lookupPreview.metrics.fiftyTwoWeekLow)} - ${formatCurrency(lookupPreview.metrics.fiftyTwoWeekHigh)}` : '—'}</strong></div>
            </div>
          </div>
        )}

        <label className="stocks-field">
          <span>Investment Thesis</span>
          <textarea value={form.thesis} onChange={(e) => setField('thesis', e.target.value)} rows={4} placeholder="Summarize the edge, catalyst, and risk in plain language." />
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="stocks-eyebrow">Long-form Notes</p>
              <h3 className="stocks-panel-title">Research Journal</h3>
            </div>
          </div>
          <div className="stocks-editor">
            <TiptapEditor content={form.notesHtml} onChange={(value) => setField('notesHtml', value)} placeholder="Capture earnings notes, bear case, valuation anchors, and catalysts..." />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="stocks-panel space-y-4">
          <div>
            <p className="stocks-eyebrow">Position Inputs</p>
            <h3 className="stocks-panel-title">Holding State</h3>
          </div>
          <label className="stocks-field">
            <span>Shares</span>
            <input value={form.shares} onChange={(e) => setField('shares', e.target.value)} placeholder="12.5" inputMode="decimal" />
          </label>
          <label className="stocks-field">
            <span>Average Cost Basis ($)</span>
            <input value={form.averageCostBasis} onChange={(e) => setField('averageCostBasis', e.target.value)} placeholder="412.34" inputMode="decimal" />
          </label>
        </div>

        <div className="stocks-panel space-y-4">
          <div>
            <p className="stocks-eyebrow">Manual Overrides</p>
            <h3 className="stocks-panel-title">Valuation Inputs</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="stocks-field">
              <span>Current Price ($)</span>
              <input value={form.manualCurrentPrice} onChange={(e) => setField('manualCurrentPrice', e.target.value)} placeholder="0.00" inputMode="decimal" />
            </label>
            <label className="stocks-field">
              <span>Analyst Target ($)</span>
              <input value={form.manualTargetPrice} onChange={(e) => setField('manualTargetPrice', e.target.value)} placeholder="0.00" inputMode="decimal" />
            </label>
            <label className="stocks-field">
              <span>P/E</span>
              <input value={form.manualPeRatio} onChange={(e) => setField('manualPeRatio', e.target.value)} placeholder="25.3" inputMode="decimal" />
            </label>
            <label className="stocks-field">
              <span>P/B</span>
              <input value={form.manualPbRatio} onChange={(e) => setField('manualPbRatio', e.target.value)} placeholder="6.4" inputMode="decimal" />
            </label>
            <label className="stocks-field">
              <span>P/S</span>
              <input value={form.manualPsRatio} onChange={(e) => setField('manualPsRatio', e.target.value)} placeholder="9.1" inputMode="decimal" />
            </label>
            <label className="stocks-field">
              <span>EPS Growth (%)</span>
              <input value={form.manualEpsGrowth} onChange={(e) => setField('manualEpsGrowth', e.target.value)} placeholder="14.2" inputMode="decimal" />
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}