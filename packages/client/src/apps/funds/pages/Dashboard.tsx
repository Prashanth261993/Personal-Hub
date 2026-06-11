import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type { FundsDashboardRow } from '@networth/shared';
import { createFund, deleteFund, fetchFunds, refreshFund } from '../api';
import ConfirmModal from '../../../components/ConfirmModal';

function compactCurrency(cents: number | null): string {
  if (cents === null) return '—';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(dollars);
}

export default function FundsDashboard() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [cik, setCik] = useState('');
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FundsDashboardRow | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const { data: funds, isLoading } = useQuery({
    queryKey: ['funds'],
    queryFn: fetchFunds,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['funds'] });
    queryClient.invalidateQueries({ queryKey: ['funds-summary'] });
  };

  const addMutation = useMutation({
    mutationFn: createFund,
    meta: { successMessage: 'Fund added' },
    onSuccess: () => {
      setShowAdd(false);
      setCik('');
      setName('');
      invalidate();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: refreshFund,
    meta: { successMessage: 'Fund refreshed from SEC' },
    onSettled: () => {
      setRefreshingId(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFund,
    meta: { successMessage: 'Fund removed' },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-600" />
            Hedge Fund 13F Tracker
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Quarterly institutional holdings parsed from SEC EDGAR. Data is reported up to 45 days
            after each quarter ends.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Fund
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Track a fund by SEC CIK</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">CIK number</label>
              <input
                value={cik}
                onChange={(e) => setCik(e.target.value)}
                placeholder="e.g. 1067983"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (optional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tiger Global Management"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={() => cik.trim() && addMutation.mutate({ cik: cik.trim(), name: name.trim() || undefined })}
              disabled={!cik.trim() || addMutation.isPending}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <a
              href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=13F-HR"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              Find a CIK on EDGAR <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading funds…</p>
      ) : !funds || funds.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No funds tracked yet. Add one by CIK to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {funds.map((fund) => {
            const isRefreshing = refreshingId === fund.id && refreshMutation.isPending;
            return (
              <div
                key={fund.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-amber-300 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <button
                    onClick={() => setDeleteTarget(fund)}
                    className="text-gray-300 hover:text-danger-500 transition-colors"
                    title="Remove fund"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link to={`/funds/${fund.id}`} className="group flex-1">
                  <h3 className="font-semibold text-gray-900 leading-snug group-hover:text-amber-700 transition-colors">
                    {fund.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">CIK {fund.cik}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Latest quarter</p>
                      <p className="font-medium text-gray-900">{fund.latestQuarter ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Positions</p>
                      <p className="font-medium text-gray-900">{fund.positionCount ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Portfolio value</p>
                      <p className="font-medium text-gray-900">{compactCurrency(fund.totalValueCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Top holding</p>
                      <p className="font-medium text-gray-900 truncate" title={fund.topHoldingName ?? ''}>
                        {fund.topHoldingName ?? '—'}
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setRefreshingId(fund.id);
                      refreshMutation.mutate(fund.id);
                    }}
                    disabled={isRefreshing}
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing…' : 'Refresh from SEC'}
                  </button>
                  <Link
                    to={`/funds/${fund.id}`}
                    className="text-xs text-gray-400 hover:text-amber-600 flex items-center gap-1"
                  >
                    Holdings <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Remove fund"
        message={`Remove "${deleteTarget?.name}" and all its imported filings? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
