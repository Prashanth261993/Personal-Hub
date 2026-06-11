import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, RefreshCw, ExternalLink } from 'lucide-react';
import type { HoldingChangeType } from '@networth/shared';
import { fetchFund, fetchFundDeltas, fetchFundHoldings, refreshFund } from '../api';

function compactCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

function fullCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function signedCurrency(cents: number): string {
  const sign = cents > 0 ? '+' : cents < 0 ? '-' : '';
  return `${sign}${compactCurrency(Math.abs(cents))}`;
}

const CHANGE_STYLES: Record<HoldingChangeType, { label: string; badge: string; text: string }> = {
  new: { label: 'New', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' },
  add: { label: 'Added', badge: 'bg-green-100 text-green-700', text: 'text-green-600' },
  trim: { label: 'Trimmed', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-600' },
  exit: { label: 'Exited', badge: 'bg-red-100 text-red-700', text: 'text-red-600' },
  hold: { label: 'Held', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-500' },
};

export default function FundDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'changes'>('holdings');

  const { data, isLoading } = useQuery({
    queryKey: ['fund', id],
    queryFn: () => fetchFund(id),
    enabled: !!id,
  });

  const activeFilingId = selectedFilingId ?? data?.latestFiling?.id ?? null;
  const isLatest = activeFilingId === (data?.latestFiling?.id ?? null);

  const { data: holdings, isLoading: holdingsLoading } = useQuery({
    queryKey: ['fund-holdings', id, activeFilingId],
    queryFn: () => fetchFundHoldings(id, activeFilingId ?? undefined),
    enabled: !!id && !!activeFilingId && !isLatest,
  });

  const { data: deltas, isLoading: deltasLoading } = useQuery({
    queryKey: ['fund-deltas', id],
    queryFn: () => fetchFundDeltas(id),
    enabled: !!id && activeTab === 'changes',
  });

  // Use embedded holdings when viewing the latest filing, otherwise the fetched set.
  const rows = isLatest ? data?.holdings ?? [] : holdings ?? [];

  const refreshMutation = useMutation({
    mutationFn: () => refreshFund(id),
    meta: { successMessage: 'Fund refreshed from SEC' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund', id] });
      queryClient.invalidateQueries({ queryKey: ['fund-deltas', id] });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
    },
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading fund…</p>;
  if (!data) return <p className="text-gray-500">Fund not found.</p>;

  const { fund, filings } = data;
  const activeFiling = filings.find((f) => f.id === activeFilingId) ?? null;

  return (
    <div className="space-y-6">
      <Link to="/funds" className="text-sm text-gray-400 hover:text-amber-600 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to funds
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{fund.name}</h2>
              <p className="text-sm text-gray-400">
                CIK {fund.cik}
                {' · '}
                <a
                  href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=13F-HR`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  View on EDGAR <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            {refreshMutation.isPending ? 'Refreshing…' : 'Refresh from SEC'}
          </button>
        </div>

        {filings.length > 0 && (
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Filing period</label>
              <select
                value={activeFilingId ?? ''}
                onChange={(e) => setSelectedFilingId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {filings.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.quarter} (filed {f.filedAt})
                  </option>
                ))}
              </select>
            </div>
            {activeFiling && (
              <>
                <div>
                  <p className="text-xs text-gray-400">Portfolio value</p>
                  <p className="font-semibold text-gray-900">{fullCurrency(activeFiling.totalValueCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Positions</p>
                  <p className="font-semibold text-gray-900">{activeFiling.positionCount}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {filings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500">
            No filings imported yet. Click “Refresh from SEC” to pull the latest 13F-HR.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'holdings'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Holdings
            </button>
            <button
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'changes'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Changes
            </button>
          </div>

          {activeTab === 'holdings' ? (
            holdingsLoading ? (
              <p className="px-6 py-6 text-sm text-gray-400">Loading holdings…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Issuer</th>
                      <th className="px-6 py-3 font-medium">CUSIP</th>
                      <th className="px-6 py-3 font-medium text-right">Value</th>
                      <th className="px-6 py-3 font-medium text-right">Shares</th>
                      <th className="px-6 py-3 font-medium text-right">% Portfolio</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => b.valueCents - a.valueCents)
                      .map((h) => (
                        <tr key={h.id} className="border-b border-gray-50 hover:bg-amber-50/40">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{h.issuerName}</span>
                              {h.stockId ? (
                                <Link
                                  to={`/stocks/${h.stockId}`}
                                  className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-mono hover:bg-primary-100 inline-flex items-center gap-1"
                                >
                                  {h.ticker ?? 'View'} <ExternalLink className="w-3 h-3" />
                                </Link>
                              ) : h.ticker ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                                  {h.ticker}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-gray-400 font-mono text-xs">{h.cusip}</td>
                          <td className="px-6 py-3 text-right text-gray-900">{compactCurrency(h.valueCents)}</td>
                          <td className="px-6 py-3 text-right text-gray-600">
                            {h.shares.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right text-gray-600">
                            {h.pctOfPortfolio.toFixed(1)}%
                          </td>
                          <td className="px-6 py-3">
                            {h.putCall ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {h.putCall}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          ) : deltasLoading ? (
            <p className="px-6 py-6 text-sm text-gray-400">Computing changes…</p>
          ) : !deltas || deltas.deltas.length === 0 || !deltas.fromFiling ? (
            <p className="px-6 py-6 text-sm text-gray-400">
              Need at least two imported filings to compare. Click “Refresh from SEC” to backfill prior quarters.
            </p>
          ) : (
            <>
              <p className="px-6 pt-4 text-xs text-gray-400">
                Comparing {deltas.fromFiling.quarter} → {deltas.toFiling?.quarter}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Issuer</th>
                      <th className="px-6 py-3 font-medium">Change</th>
                      <th className="px-6 py-3 font-medium text-right">Δ Shares</th>
                      <th className="px-6 py-3 font-medium text-right">Δ Value</th>
                      <th className="px-6 py-3 font-medium text-right">% Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deltas.deltas.map((d) => {
                      const style = CHANGE_STYLES[d.changeType];
                      return (
                        <tr key={d.cusip} className="border-b border-gray-50 hover:bg-amber-50/40">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{d.issuerName}</span>
                              {d.stockId ? (
                                <Link
                                  to={`/stocks/${d.stockId}`}
                                  className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-mono hover:bg-primary-100 inline-flex items-center gap-1"
                                >
                                  {d.ticker ?? 'View'} <ExternalLink className="w-3 h-3" />
                                </Link>
                              ) : d.ticker ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                                  {d.ticker}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                              {style.label}
                            </span>
                          </td>
                          <td className={`px-6 py-3 text-right ${style.text}`}>
                            {d.sharesChange > 0 ? '+' : ''}
                            {d.sharesChange.toLocaleString()}
                            {d.sharesChangePercent !== null && d.changeType !== 'hold' && (
                              <span className="text-gray-400 text-xs ml-1">
                                ({d.sharesChangePercent > 0 ? '+' : ''}
                                {d.sharesChangePercent.toFixed(0)}%)
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-3 text-right ${style.text}`}>
                            {signedCurrency(d.valueChangeCents)}
                          </td>
                          <td className="px-6 py-3 text-right text-gray-600">
                            {d.toPctOfPortfolio.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
