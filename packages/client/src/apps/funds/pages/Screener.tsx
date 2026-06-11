import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Search } from 'lucide-react';
import type { ScreenerRow } from '@networth/shared';
import { fetchScreener } from '../api';

function compactCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

type SortKey = 'fundCount' | 'totalValueCents' | 'avgPctOfPortfolio' | 'issuerName';

export default function Screener() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fundCount');
  const [minFunds, setMinFunds] = useState(1);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['funds-screener'],
    queryFn: fetchScreener,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => {
      if (r.fundCount < minFunds) return false;
      if (!term) return true;
      return (
        r.issuerName.toLowerCase().includes(term) ||
        (r.ticker ?? '').toLowerCase().includes(term) ||
        r.cusip.toLowerCase().includes(term)
      );
    });
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'issuerName') return a.issuerName.localeCompare(b.issuerName);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
    return sorted;
  }, [rows, search, sortKey, minFunds]);

  return (
    <div className="space-y-6">
      <Link to="/funds" className="text-sm text-gray-400 hover:text-amber-600 inline-flex items-center gap-1">
        Funds
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
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

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Issuer, ticker or CUSIP"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sort by</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="fundCount"># Funds holding</option>
              <option value="totalValueCents">Total value</option>
              <option value="avgPctOfPortfolio">Avg conviction</option>
              <option value="issuerName">Issuer name</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min funds</label>
            <select
              value={minFunds}
              onChange={(e) => setMinFunds(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-400">Building screener…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400 text-center">
            No positions match. Refresh some funds from SEC to populate holdings.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Issuer</th>
                  <th className="px-6 py-3 font-medium text-right"># Funds</th>
                  <th className="px-6 py-3 font-medium text-right">Total Value</th>
                  <th className="px-6 py-3 font-medium text-right">Avg Conviction</th>
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
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{r.fundCount}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{compactCurrency(r.totalValueCents)}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{r.avgPctOfPortfolio.toFixed(1)}%</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.funds.map((f) => (
                          <Link
                            key={f.fundId}
                            to={`/funds/${f.fundId}`}
                            className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                            title={`${compactCurrency(f.valueCents)} · ${f.pctOfPortfolio.toFixed(1)}%`}
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
