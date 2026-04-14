import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { CreateStockRequest } from '@networth/shared';
import { createStock, lookupStock } from '../api';
import { useStocksTheme } from '../useStocksTheme';
import StockEditor from '../components/StockEditor';

export default function NewStock() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { themeClassName } = useStocksTheme();

  const createMutation = useMutation({
    mutationFn: createStock,
    onSuccess: (stock) => {
      queryClient.invalidateQueries({ queryKey: ['stocks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-summary'] });
      navigate(`/stocks/${stock.id}`);
    },
  });

  const lookupMutation = useMutation({
    mutationFn: lookupStock,
  });

  return (
    <div className={`stocks-shell ${themeClassName} space-y-6`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/stocks')} className="stocks-link-button mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <p className="stocks-eyebrow">New Stock</p>
          <h1 className="stocks-title">Create Research Record</h1>
        </div>
      </div>

      <StockEditor
        saving={createMutation.isPending}
        refreshing={lookupMutation.isPending}
        lookupPreview={lookupMutation.data ?? null}
        onRefresh={(symbol) => lookupMutation.mutateAsync(symbol)}
        onSave={(payload) => {
          const create = payload as CreateStockRequest;
          if (lookupMutation.data) {
            create.initialMetrics = lookupMutation.data.metrics;
            create.initialAnalystRating = lookupMutation.data.analystRating;
          }
          createMutation.mutate(create);
        }}
      />
    </div>
  );
}