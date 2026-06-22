import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ExternalLink, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type {
  FundScreenerFilters,
  FundScreenerPreset,
  FundScreenerRangeFilter,
  FundSentimentFilter,
  PositionSentiment,
  ScreenerRow,
} from '@networth/shared';
import {
  createFundPreset,
  deleteFundPreset,
  fetchFundPresets,
  fetchScreener,
} from '../api';

function compactCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

type SortKey =
  | 'fundCount'
  | 'totalValueCents'
  | 'bullishValueCents'
  | 'bearishValueCents'
  | 'avgPctOfPortfolio'
  | 'convictionPct'
  | 'maxValueChangeCents'
  | 'maxSharesChangePercent'
  | 'upsidePct'
  | 'peRatio'
  | 'issuerName';

const SORT_OPTIONS: { value: SortKey; label: string; desc: string }[] = [
  {
    value: 'fundCount',
    label: '# Funds holding',
    desc: 'Number of distinct tracked funds that hold the security in their latest filing.',
  },
  {
    value: 'totalValueCents',
    label: 'Total value',
    desc: 'Sum of every holding fund’s position value (bullish + put exposure).',
  },
  {
    value: 'bullishValueCents',
    label: 'Bullish value',
    desc: 'Combined value of share + call (long/upside) exposure across all funds.',
  },
  {
    value: 'bearishValueCents',
    label: 'Bearish (put) value',
    desc: 'Combined value of put (downside) exposure across all funds.',
  },
  {
    value: 'avgPctOfPortfolio',
    label: 'Avg portfolio weight',
    desc: 'Average of each holding fund’s total position weight (% of that fund’s 13F).',
  },
  {
    value: 'convictionPct',
    label: 'Long conviction',
    desc: 'Average long-share portfolio weight only — ignores puts so bearish bets don’t inflate it.',
  },
  {
    value: 'maxValueChangeCents',
    label: 'Biggest stake increase ($)',
    desc: 'Largest single-fund position increase in dollar value vs the prior quarter.',
  },
  {
    value: 'maxSharesChangePercent',
    label: 'Biggest stake increase (%)',
    desc: 'Largest single-fund share-count increase as a percentage vs the prior quarter.',
  },
  {
    value: 'upsidePct',
    label: 'Upside to target',
    desc: 'Analyst target vs current price (tracked stocks only): (target − price) / price.',
  },
  {
    value: 'peRatio',
    label: 'P/E (low → high)',
    desc: 'Price-to-earnings ratio for tracked stocks, cheapest first.',
  },
  {
    value: 'issuerName',
    label: 'Issuer name',
    desc: 'Alphabetical by issuer name.',
  },
];

type MetricKey = 'upsidePct' | 'peRatio' | 'pbRatio' | 'psRatio' | 'epsGrowth' | 'marketCap';

const METRIC_FIELDS: { key: MetricKey; label: string }[] = [
  { key: 'upsidePct', label: 'Upside %' },
  { key: 'peRatio', label: 'P/E' },
  { key: 'pbRatio', label: 'P/B' },
  { key: 'psRatio', label: 'P/S' },
  { key: 'epsGrowth', label: 'EPS growth %' },
  { key: 'marketCap', label: 'Market cap ($)' },
];

const EMPTY_RANGES: Record<MetricKey, FundScreenerRangeFilter> = {
  upsidePct: { min: '', max: '' },
  peRatio: { min: '', max: '' },
  psRatio: { min: '', max: '' },
  pbRatio: { min: '', max: '' },
  epsGrowth: { min: '', max: '' },
  marketCap: { min: '', max: '' },
};

const SENTIMENT_OPTIONS: { value: FundSentimentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bullish', label: 'Bullish' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
];

const SENTIMENT_STYLES: Record<PositionSentiment, string> = {
  bullish: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bearish: 'bg-rose-50 text-rose-700 border-rose-200',
  mixed: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-gray-100 text-gray-500 border-gray-200',
};

function inRange(value: number | null | undefined, range: FundScreenerRangeFilter): boolean {
  if (range.min === '' && range.max === '') return true;
  if (value == null) return false;
  const min = range.min === '' ? -Infinity : Number(range.min);
  const max = range.max === '' ? Infinity : Number(range.max);
  if (Number.isNaN(min) || Number.isNaN(max)) return true;
  return value >= min && value <= max;
}

function metricValue(row: ScreenerRow, key: MetricKey): number | null {
  if (!row.metrics) return null;
  return row.metrics[key];
}

export default function Screener() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fundCount');
  const [minFunds, setMinFunds] = useState(1);
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [sentiment, setSentiment] = useState<FundSentimentFilter>('all');
  const [minStakeIncreasePct, setMinStakeIncreasePct] = useState('');
  const [ranges, setRanges] = useState<Record<MetricKey, FundScreenerRangeFilter>>(EMPTY_RANGES);
  const [showMetrics, setShowMetrics] = useState(false);
  const [activePreset, setActivePreset] = useState('');

  const { data: rows, isLoading } = useQuery({
    queryKey: ['funds-screener'],
    queryFn: fetchScreener,
  });
  const { data: presets } = useQuery({
    queryKey: ['funds-screener-presets'],
    queryFn: fetchFundPresets,
  });

  const hasMetricFilter = useMemo(
    () =>
      METRIC_FIELDS.some(({ key }) => ranges[key].min !== '' || ranges[key].max !== '') ||
      minStakeIncreasePct !== '',
    [ranges, minStakeIncreasePct],
  );

  const setRange = (key: MetricKey, side: 'min' | 'max', value: string) =>
    setRanges((prev) => ({ ...prev, [key]: { ...prev[key], [side]: value } }));

  const applyPreset = (preset: FundScreenerPreset) => {
    const f = preset.filters;
    setSearch(f.search ?? '');
    setMinFunds(f.minFunds ?? 1);
    setTrackedOnly(f.trackedOnly ?? false);
    setSentiment(f.sentiment ?? 'all');
    setMinStakeIncreasePct(f.minStakeIncreasePct ?? '');
    setRanges({
      upsidePct: f.upsidePct ?? { min: '', max: '' },
      peRatio: f.peRatio ?? { min: '', max: '' },
      pbRatio: f.pbRatio ?? { min: '', max: '' },
      psRatio: f.psRatio ?? { min: '', max: '' },
      epsGrowth: f.epsGrowth ?? { min: '', max: '' },
      marketCap: f.marketCap ?? { min: '', max: '' },
    });
    setSortKey((preset.sortKey as SortKey) || 'fundCount');
    if (
      f.upsidePct ||
      f.peRatio ||
      f.pbRatio ||
      f.psRatio ||
      f.epsGrowth ||
      f.marketCap ||
      f.minStakeIncreasePct
    ) {
      setShowMetrics(true);
    }
  };

  useEffect(() => {
    setActivePreset((current) => {
      if (!current || !presets) return current;
      return presets.some((p) => p.id === current) ? current : '';
    });
  }, [presets]);

  const currentFilters = (): FundScreenerFilters => ({
    search: search || undefined,
    minFunds,
    trackedOnly: trackedOnly || undefined,
    sentiment: sentiment !== 'all' ? sentiment : undefined,
    minStakeIncreasePct: minStakeIncreasePct || undefined,
    upsidePct: ranges.upsidePct.min || ranges.upsidePct.max ? ranges.upsidePct : undefined,
    peRatio: ranges.peRatio.min || ranges.peRatio.max ? ranges.peRatio : undefined,
    pbRatio: ranges.pbRatio.min || ranges.pbRatio.max ? ranges.pbRatio : undefined,
    psRatio: ranges.psRatio.min || ranges.psRatio.max ? ranges.psRatio : undefined,
    epsGrowth: ranges.epsGrowth.min || ranges.epsGrowth.max ? ranges.epsGrowth : undefined,
    marketCap: ranges.marketCap.min || ranges.marketCap.max ? ranges.marketCap : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const label = window.prompt('Name this preset');
      if (!label?.trim()) return Promise.reject(new Error('cancelled'));
      return createFundPreset({ label: label.trim(), description: '', filters: currentFilters(), sortKey });
    },
    onSuccess: (preset) => {
      queryClient.invalidateQueries({ queryKey: ['funds-screener-presets'] });
      if (preset?.id) setActivePreset(preset.id);
    },
    meta: { successMessage: 'Preset saved' },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFundPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds-screener-presets'] });
      setActivePreset('');
    },
    meta: { successMessage: 'Preset deleted' },
  });

  const resetFilters = () => {
    setSearch('');
    setMinFunds(1);
    setTrackedOnly(false);
    setSentiment('all');
    setMinStakeIncreasePct('');
    setRanges(EMPTY_RANGES);
    setSortKey('fundCount');
    setActivePreset('');
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const stakeMin = minStakeIncreasePct === '' ? null : Number(minStakeIncreasePct);
    const list = (rows ?? []).filter((r) => {
      if (r.fundCount < minFunds) return false;
      if (trackedOnly && !r.isTracked) return false;
      if (sentiment !== 'all' && r.sentiment !== sentiment) return false;
      if (stakeMin != null && !Number.isNaN(stakeMin)) {
        if (r.maxSharesChangePercent == null || r.maxSharesChangePercent < stakeMin) return false;
      }
      for (const { key } of METRIC_FIELDS) {
        const range = ranges[key];
        if (range.min === '' && range.max === '') continue;
        if (!inRange(metricValue(r, key), range)) return false;
      }
      if (!term) return true;
      return (
        r.issuerName.toLowerCase().includes(term) ||
        (r.ticker ?? '').toLowerCase().includes(term) ||
        r.cusip.toLowerCase().includes(term)
      );
    });

    const numeric = (r: ScreenerRow): number => {
      switch (sortKey) {
        case 'upsidePct':
          return r.metrics?.upsidePct ?? -Infinity;
        case 'peRatio':
          return r.metrics?.peRatio == null ? Infinity : r.metrics.peRatio;
        case 'maxSharesChangePercent':
          return r.maxSharesChangePercent ?? -Infinity;
        case 'maxValueChangeCents':
          return r.maxValueChangeCents ?? -Infinity;
        default:
          return r[sortKey] as number;
      }
    };

    return [...list].sort((a, b) => {
      if (sortKey === 'issuerName') return a.issuerName.localeCompare(b.issuerName);
      if (sortKey === 'peRatio') return numeric(a) - numeric(b); // low → high
      return numeric(b) - numeric(a);
    });
  }, [rows, search, sortKey, minFunds, trackedOnly, sentiment, minStakeIncreasePct, ranges]);

  const selectedPreset = presets?.find((p) => p.id === activePreset);

  return (
    <div className="space-y-6">
      <Link to="/funds" className="text-sm text-gray-400 hover:text-amber-600 inline-flex items-center gap-1">
        Funds
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Cross-Fund Screener</h2>
              <p className="text-sm text-gray-400">
                Most-owned positions across every tracked fund's latest 13F filing.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Preset</label>
              <select
                value={activePreset}
                onChange={(e) => {
                  const id = e.target.value;
                  setActivePreset(id);
                  const preset = presets?.find((p) => p.id === id);
                  if (preset) applyPreset(preset);
                  else resetFilters();
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[180px]"
              >
                <option value="">Custom filters…</option>
                {presets?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.builtIn ? '★ ' : ''}
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center gap-1.5 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            {selectedPreset && !selectedPreset.builtIn && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(selectedPreset.id)}
                className="inline-flex items-center gap-1.5 border border-rose-200 text-rose-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {selectedPreset?.description && (
          <p className="mt-3 text-xs text-gray-500">{selectedPreset.description}</p>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Issuer, ticker or CUSIP"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sort by</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.desc}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 max-w-xs">
              {SORT_OPTIONS.find((o) => o.value === sortKey)?.desc}
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min funds</label>
            <select
              value={minFunds}
              onChange={(e) => setMinFunds(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input
              type="checkbox"
              checked={trackedOnly}
              onChange={(e) => setTrackedOnly(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Tracked stocks only
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Sentiment</span>
          {SENTIMENT_OPTIONS.map((s) => {
            const active = sentiment === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSentiment(s.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? s.value === 'all'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : SENTIMENT_STYLES[s.value as PositionSentiment].replace('50', '100')
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMetrics((v) => !v)}
            className={`ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              hasMetricFilter
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Metric filters{hasMetricFilter ? ' (on)' : ''}
          </button>
        </div>

        {showMetrics && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-3">
              Metric filters apply to tracked stocks only (untracked positions have no fundamentals).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min stake increase %</label>
                <input
                  type="number"
                  value={minStakeIncreasePct}
                  onChange={(e) => setMinStakeIncreasePct(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {METRIC_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={ranges[key].min}
                      onChange={(e) => setRange(key, 'min', e.target.value)}
                      placeholder="min"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-gray-300">–</span>
                    <input
                      type="number"
                      value={ranges[key].max}
                      onChange={(e) => setRange(key, 'max', e.target.value)}
                      placeholder="max"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-400">Building screener…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400 text-center">
            No positions match. Try loosening filters or refresh some funds from SEC.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Issuer</th>
                  <th className="px-4 py-3 font-medium">Sentiment</th>
                  <th className="px-4 py-3 font-medium text-right"># Funds</th>
                  <th className="px-4 py-3 font-medium text-right">Total Value</th>
                  <th className="px-4 py-3 font-medium text-right">Conviction</th>
                  <th className="px-4 py-3 font-medium">QoQ Moves</th>
                  <th className="px-4 py-3 font-medium text-right">Upside</th>
                  <th className="px-4 py-3 font-medium text-right">P/E</th>
                  <th className="px-6 py-3 font-medium">Held by</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: ScreenerRow) => (
                  <tr key={r.cusip} className="border-b border-gray-50 hover:bg-amber-50/40 align-top">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{r.issuerName}</span>
                        {r.stockId ? (
                          <Link
                            to={`/stocks/${r.stockId}`}
                            className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-mono hover:bg-primary-100 inline-flex items-center gap-1"
                          >
                            {r.ticker ?? 'View'} <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : r.ticker ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                            {r.ticker}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-300 font-mono mt-0.5">{r.cusip}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SENTIMENT_STYLES[r.sentiment]}`}
                      >
                        {r.sentiment}
                      </span>
                      {r.bearishValueCents > 0 && (
                        <p className="text-[11px] text-rose-500 mt-1">
                          puts {compactCurrency(r.bearishValueCents)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.fundCount}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{compactCurrency(r.totalValueCents)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.convictionPct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.fundsNew > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            {r.fundsNew} new
                          </span>
                        )}
                        {r.fundsAdded > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            {r.fundsAdded} add
                          </span>
                        )}
                        {r.fundsTrimmed > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                            {r.fundsTrimmed} trim
                          </span>
                        )}
                        {r.fundsHold > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {r.fundsHold} hold
                          </span>
                        )}
                      </div>
                      {r.maxSharesChangePercent != null && r.maxSharesChangePercent > 0 && (
                        <p
                          className="text-[11px] text-emerald-600 mt-1"
                          title="Largest single-fund stake increase this quarter"
                        >
                          +{r.maxSharesChangePercent.toFixed(0)}% max stake
                          {r.maxValueChangeCents != null && r.maxValueChangeCents > 0 && (
                            <span className="text-emerald-500">
                              {' '}({compactCurrency(r.maxValueChangeCents)})
                            </span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.metrics?.upsidePct != null ? (
                        <span className={r.metrics.upsidePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {r.metrics.upsidePct >= 0 ? '+' : ''}
                          {r.metrics.upsidePct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.metrics?.peRatio != null ? (
                        r.metrics.peRatio.toFixed(1)
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.funds.map((f) => (
                          <Link
                            key={f.fundId}
                            to={`/funds/${f.fundId}`}
                            className={`text-xs px-1.5 py-0.5 rounded hover:opacity-80 ${
                              f.bearishValueCents > 0 && f.bullishValueCents === 0
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                            title={`${compactCurrency(f.valueCents)} · ${f.pctOfPortfolio.toFixed(1)}%${
                              f.changeType ? ` · ${f.changeType}` : ''
                            }`}
                          >
                            {f.fundName}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
