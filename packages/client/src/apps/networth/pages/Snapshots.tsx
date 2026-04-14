import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchSnapshots, deleteSnapshot } from '../api';
import { formatCurrency } from '@networth/shared';
import { Plus, Trash2, Eye, Copy } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';

export default function Snapshots() {
  const queryClient = useQueryClient();
  const { data: snapshots, isLoading } = useQuery({ queryKey: ['snapshots'], queryFn: fetchSnapshots });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: deleteSnapshot,
    meta: { successMessage: 'Snapshot deleted' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['snapshots'] }),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading snapshots...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Snapshots</h2>
        <Link
          to="/networth/snapshots/new"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Snapshot
        </Link>
      </div>

      {(!snapshots || snapshots.length === 0) ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">No snapshots yet. Create your first one!</p>
          <Link
            to="/networth/snapshots/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Snapshot
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Note</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Assets</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Liabilities</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Net Worth</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{snap.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{snap.note || '—'}</td>
                  <td className="px-6 py-4 text-sm text-right text-success-600 font-medium">
                    {formatCurrency(snap.totalAssets)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-danger-600 font-medium">
                    {formatCurrency(Math.abs(snap.totalLiabilities))}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(snap.netWorth)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/networth/snapshots/${snap.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        title="View/Edit"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/networth/snapshots/new?carryFrom=${snap.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        title="Carry forward"
                      >
                        <Copy className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setDeleteId(snap.id)}
                        className="p-2 text-gray-400 hover:text-danger-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Snapshot"
        message="This will permanently delete this snapshot and all its entries. This cannot be undone."
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
