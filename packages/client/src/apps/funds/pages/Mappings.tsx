import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Search, Tags, Trash2 } from 'lucide-react';
import { deleteMapping, fetchMappings, upsertMapping } from '../api';

function compactCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export default function Mappings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['funds-mappings'],
    queryFn: fetchMappings,
  });

  const saveMutation = useMutation({
    mutationFn: ({ cusip, ticker }: { cusip: string; ticker: string }) =>
      upsertMapping({ cusip, ticker }),
    meta: { successMessage: 'Ticker mapped' },
    onSuccess: (_res, vars) => {
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.cusip];
        return next;
      });
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (cusip: string) => deleteMapping(cusip),
    meta: { successMessage: 'Mapping removed' },
    onSuccess: invalidate,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['funds-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['funds-screener'] });
    queryClient.invalidateQueries({ queryKey: ['funds'] });
  }

  const unmapped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.unmapped ?? []).filter(
      (u) => !term || u.issuerName.toLowerCase().includes(term) || u.cusip.toLowerCase().includes(term),
    );
  }, [data, search]);

  const mapped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.mapped ?? []).filter(
      (m) =>
        !term ||
        (m.issuerName ?? '').toLowerCase().includes(term) ||
        m.ticker.toLowerCase().includes(term) ||
        m.cusip.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <Link to="/funds" className="text-sm text-gray-400 hover:text-amber-600 inline-flex items-center gap-1">
        Funds
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <Tags className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Ticker Mapping</h2>
            <p className="text-sm text-gray-400">
              Map 13F issuers (by CUSIP) to tickers. Saved mappings are reused automatically for
              future fund refreshes and apply to every fund holding the same security.
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issuer, ticker or CUSIP"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Unmapped securities */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Unmapped securities</h3>
          <span className="text-xs text-gray-400">{unmapped.length} without a ticker</span>
        </div>

        {isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-400">Loading…</p>
        ) : unmapped.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-400">
            Everything is mapped. New unmatched issuers will appear here after a fund refresh.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Issuer</th>
                  <th className="px-6 py-3 font-medium">CUSIP</th>
                  <th className="px-6 py-3 font-medium text-right">Holdings</th>
                  <th className="px-6 py-3 font-medium text-right">Value</th>
                  <th className="px-6 py-3 font-medium">Ticker</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map((u) => {
                  const draft = drafts[u.cusip] ?? '';
                  const save = () => {
                    const t = draft.trim();
                    if (t) saveMutation.mutate({ cusip: u.cusip, ticker: t });
                  };
                  return (
                    <tr key={u.cusip} className="border-b border-gray-50 hover:bg-amber-50/40">
                      <td className="px-6 py-3 font-medium text-gray-900">{u.issuerName}</td>
                      <td className="px-6 py-3 text-gray-400 font-mono text-xs">{u.cusip}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{u.holdingCount}</td>
                      <td className="px-6 py-3 text-right text-gray-600">
                        {compactCurrency(u.totalValueCents)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={draft}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [u.cusip]: e.target.value.toUpperCase() }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') save();
                            }}
                            placeholder="TICKER"
                            className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={save}
                            disabled={!draft.trim() || saveMutation.isPending}
                            className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                            title="Save mapping"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Existing mappings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Saved mappings</h3>
          <span className="text-xs text-gray-400">{mapped.length} total</span>
        </div>

        {isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-400">Loading…</p>
        ) : mapped.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-400">No mappings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Issuer</th>
                  <th className="px-6 py-3 font-medium">CUSIP</th>
                  <th className="px-6 py-3 font-medium">Ticker</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mapped.map((m) => (
                  <tr key={m.cusip} className="border-b border-gray-50 hover:bg-amber-50/40">
                    <td className="px-6 py-3 font-medium text-gray-900">{m.issuerName ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-400 font-mono text-xs">{m.cusip}</td>
                    <td className="px-6 py-3">
                      {m.stockId ? (
                        <Link
                          to={`/stocks/${m.stockId}`}
                          className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-mono hover:bg-primary-100 inline-flex items-center gap-1"
                        >
                          {m.ticker} <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                          {m.ticker}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.source === 'manual'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.source}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(m.cusip)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Remove mapping"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
