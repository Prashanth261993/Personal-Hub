import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Link2, Unlink, RefreshCw, Check, AlertCircle, Search } from 'lucide-react';
import { formatCurrency } from '@networth/shared';
import type { PlaidHoldingPreview, PlaidSyncResult } from '@networth/shared';
import { useStocksTheme } from '../useStocksTheme';
import { usePlaidLink } from 'react-plaid-link';
import { createPlaidLinkToken, exchangePlaidToken, previewPlaidHoldings, syncPlaidConnection, fetchPlaidConnections, deletePlaidConnection } from '../api';
import ConfirmModal from '../../../components/ConfirmModal';

export default function Brokerage() {
  const { themeClassName } = useStocksTheme();
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<PlaidSyncResult | null>(null);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  // Preview state
  const [previewConnectionId, setPreviewConnectionId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PlaidHoldingPreview[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

  const { data: connections, isLoading } = useQuery({
    queryKey: ['plaid-connections'],
    queryFn: fetchPlaidConnections,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const linkToken = await createPlaidLinkToken();
      setPlaidLinkToken(linkToken);
    },
    meta: { errorMessage: 'Failed to connect brokerage' },
  });

  const handlePlaidSuccess = useCallback(async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
    setPlaidLinkToken(null);
    try {
      await exchangePlaidToken(publicToken, metadata?.institution?.institution_id);
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
    } catch {
      // Error handled by global toast
    }
  }, [queryClient]);

  const previewMutation = useMutation({
    mutationFn: previewPlaidHoldings,
    onSuccess: (data, connectionId) => {
      setPreviews(data);
      setPreviewConnectionId(connectionId);
      // Pre-select all tracked holdings
      setSelectedSymbols(new Set(data.filter((h) => h.isTracked).map((h) => h.symbol)));
      setLastSyncResult(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: ({ connectionId, symbols }: { connectionId: string; symbols: string[] }) =>
      syncPlaidConnection(connectionId, symbols),
    meta: { successMessage: 'Sync complete' },
    onSuccess: (result) => {
      setLastSyncResult(result);
      setPreviewConnectionId(null);
      setPreviews([]);
      setSelectedSymbols(new Set());
      queryClient.invalidateQueries({ queryKey: ['stocks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlaidConnection,
    meta: { successMessage: 'Brokerage disconnected' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-dashboard'] });
      setConfirmDeleteId(null);
    },
  });

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const selectAllTracked = () => {
    setSelectedSymbols(new Set(previews.filter((h) => h.isTracked).map((h) => h.symbol)));
  };

  const selectNone = () => setSelectedSymbols(new Set());

  const handleConfirmSync = () => {
    if (!previewConnectionId || selectedSymbols.size === 0) return;
    syncMutation.mutate({ connectionId: previewConnectionId, symbols: Array.from(selectedSymbols) });
  };

  const parseAccounts = (json: string | null) => {
    if (!json) return [];
    try { return JSON.parse(json) as Array<{ id: string; name: string; type: string; mask: string | null }>; }
    catch { return []; }
  };

  return (
    <div className={`stocks-shell ${themeClassName} space-y-6`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="stocks-eyebrow">Brokerage Integration</p>
          <h1 className="stocks-title">Connected Accounts</h1>
          <p className="stocks-subtitle">Link your brokerage to auto-sync shares and cost basis for tracked stocks.</p>
        </div>
        <button
          type="button"
          className="stocks-primary-button"
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending}
        >
          <Link2 className="w-4 h-4" />
          Connect Brokerage
        </button>
      </div>

      {/* Plaid Link Widget */}
      {plaidLinkToken && (
        <PlaidLinkButton
          token={plaidLinkToken}
          onSuccess={handlePlaidSuccess}
          onExit={() => setPlaidLinkToken(null)}
        />
      )}

      {isLoading && (
        <div className="stocks-panel text-center py-16 text-[var(--stocks-text-muted)]">Loading connections...</div>
      )}

      {!isLoading && (!connections || connections.length === 0) && (
        <div className="stocks-panel text-center py-16">
          <Landmark className="w-12 h-12 text-[var(--stocks-text-muted)] mx-auto mb-4" />
          <p className="text-[var(--stocks-text-muted)] mb-2">No brokerages connected yet</p>
          <p className="text-sm text-[var(--stocks-text-muted)]">Connect your brokerage to import holdings for your tracked stocks.</p>
        </div>
      )}

      {/* Connected brokerages */}
      {connections && connections.length > 0 && (
        <div className="space-y-4">
          {connections.map((conn) => {
            const accounts = parseAccounts(conn.accountsJson);
            return (
              <motion.div key={conn.id} layout className="stocks-panel">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--stocks-accent)] flex items-center justify-center text-white">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-[var(--stocks-text-strong)] font-semibold">{conn.institutionName}</h3>
                      <p className="text-xs text-[var(--stocks-text-muted)]">
                        {conn.lastSyncedAt ? `Last synced: ${new Date(conn.lastSyncedAt).toLocaleString()}` : 'Never synced'}
                        {accounts.length > 0 && ` · ${accounts.length} account${accounts.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="stocks-ghost-button"
                      onClick={() => previewMutation.mutate(conn.id)}
                      disabled={previewMutation.isPending}
                    >
                      <Search className={`w-4 h-4 ${previewMutation.isPending ? 'animate-pulse' : ''}`} />
                      Preview Holdings
                    </button>
                    <button
                      type="button"
                      className="stocks-ghost-button text-red-400 hover:text-red-300"
                      onClick={() => setConfirmDeleteId(conn.id)}
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {accounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {accounts.map((a) => (
                      <span key={a.id} className="stocks-badge text-xs">
                        {a.name}{a.mask ? ` ···${a.mask}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Holding Selection Panel */}
      <AnimatePresence>
        {previewConnectionId && previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="stocks-panel space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="stocks-eyebrow">Select Holdings to Sync</p>
                <h2 className="stocks-panel-title">Choose which stocks to import</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAllTracked} className="stocks-ghost-button text-xs">
                  Select Tracked
                </button>
                <button type="button" onClick={selectNone} className="stocks-ghost-button text-xs">
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--stocks-text-muted)] text-xs uppercase tracking-wider border-b border-[var(--stocks-border)]">
                    <th className="text-center py-2 pr-2 w-10"></th>
                    <th className="text-left py-2 px-2">Symbol</th>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-right py-2 px-2">Shares</th>
                    <th className="text-right py-2 px-2">Price</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-right py-2 px-2">Cost Basis</th>
                    <th className="text-center py-2 pl-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((h) => {
                    const isSelected = selectedSymbols.has(h.symbol);
                    const canSelect = h.isTracked;
                    return (
                      <tr
                        key={h.symbol}
                        className={`border-b border-[var(--stocks-border)] last:border-0 transition-colors ${
                          canSelect ? 'cursor-pointer hover:bg-[var(--stocks-surface-strong)]' : 'opacity-50'
                        } ${isSelected ? 'bg-[var(--stocks-surface-strong)]' : ''}`}
                        onClick={() => canSelect && toggleSymbol(h.symbol)}
                      >
                        <td className="py-2.5 pr-2 text-center">
                          {canSelect && (
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-[var(--stocks-accent)] border-[var(--stocks-accent)]'
                                : 'border-[var(--stocks-border)]'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-[var(--stocks-text-strong)]">{h.symbol}</td>
                        <td className="py-2.5 px-2 text-[var(--stocks-text)] truncate max-w-48">{h.name}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--stocks-text)]">{h.shares.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--stocks-text)]">{h.currentPriceCents ? formatCurrency(h.currentPriceCents) : '—'}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--stocks-text)]">{h.currentValueCents ? formatCurrency(h.currentValueCents) : '—'}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--stocks-text-muted)]">{h.costBasisCents ? formatCurrency(h.costBasisCents) : '—'}</td>
                        <td className="py-2.5 pl-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            h.isTracked
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[var(--stocks-surface-strong)] text-[var(--stocks-text-muted)]'
                          }`}>
                            {h.isTracked ? 'Tracked' : 'Not tracked'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--stocks-border)]">
              <p className="text-sm text-[var(--stocks-text-muted)]">
                {selectedSymbols.size} of {previews.filter((h) => h.isTracked).length} tracked stock{previews.filter((h) => h.isTracked).length !== 1 ? 's' : ''} selected
                {previews.filter((h) => !h.isTracked).length > 0 && (
                  <span> · {previews.filter((h) => !h.isTracked).length} untracked (add to tracked list first to sync)</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="stocks-ghost-button"
                  onClick={() => { setPreviewConnectionId(null); setPreviews([]); setSelectedSymbols(new Set()); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="stocks-primary-button"
                  onClick={handleConfirmSync}
                  disabled={syncMutation.isPending || selectedSymbols.size === 0}
                >
                  <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  Sync {selectedSymbols.size} Stock{selectedSymbols.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync result */}
      <AnimatePresence>
        {lastSyncResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="stocks-panel space-y-3"
          >
            <h3 className="text-[var(--stocks-text-strong)] font-semibold">Sync Results</h3>
            {lastSyncResult.synced.length > 0 && (
              <div>
                <p className="text-sm text-[var(--stocks-accent)] mb-1">
                  Synced {lastSyncResult.synced.length} stock{lastSyncResult.synced.length > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {lastSyncResult.synced.map((s) => (
                    <span key={s.symbol} className="stocks-badge text-xs">{s.symbol} — {s.shares} shares</span>
                  ))}
                </div>
              </div>
            )}
            {lastSyncResult.errors.length > 0 && (
              <div className="flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>{lastSyncResult.errors.join('; ')}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Disconnect Brokerage"
        message="This will remove the connection. Your tracked stock data will be kept but will switch back to manual entry."
        onConfirm={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

// ── Plaid Link component ──
function PlaidLinkButton({ token, onSuccess, onExit }: {
  token: string;
  onSuccess: (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (public_token: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
      onSuccess(public_token, metadata);
    },
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}
