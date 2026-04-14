import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMembers, fetchCategories, fetchSnapshot, updateSnapshot } from '../api';
import { dollarsToCents, centsToDollars, formatCurrency } from '@networth/shared';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type DraftEntry = {
  key: string;
  memberId: string;
  categoryId: string;
  type: 'asset' | 'liability';
  name: string;
  dollars: string;
};

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

export default function EditSnapshot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: membersConfig } = useQuery({ queryKey: ['members'], queryFn: fetchMembers });
  const { data: catConfig } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['snapshot', id],
    queryFn: () => fetchSnapshot(id!),
    enabled: !!id,
  });

  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (snapshot && !initialized) {
      setDate(snapshot.date);
      setNote(snapshot.note || '');
      setDraftEntries(
        snapshot.entries.map((e) => ({
          key: newKey(),
          memberId: e.memberId,
          categoryId: e.categoryId,
          type: e.type,
          name: e.name,
          dollars: Math.abs(centsToDollars(e.value)).toString(),
        })),
      );
      setInitialized(true);
    }
  }, [snapshot, initialized]);

  const members = membersConfig?.members || [];
  const assetCats = catConfig?.assetCategories || [];
  const liabilityCats = catConfig?.liabilityCategories || [];

  const addEntry = (memberId: string, type: 'asset' | 'liability') => {
    const cats = type === 'asset' ? assetCats : liabilityCats;
    setDraftEntries((prev) => [
      ...prev,
      { key: newKey(), memberId, categoryId: cats[0]?.id || '', type, name: '', dollars: '' },
    ]);
  };

  const removeEntry = (key: string) => {
    setDraftEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEntry = (key: string, field: keyof DraftEntry, value: string) => {
    setDraftEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof updateSnapshot>[1]) => updateSnapshot(id!, data),
    meta: { successMessage: 'Snapshot saved' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['snapshot', id] });
      queryClient.invalidateQueries({ queryKey: ['trends'] });
      queryClient.invalidateQueries({ queryKey: ['insights-summary'] });
      navigate('/networth/snapshots');
    },
  });

  const handleSave = () => {
    const entries = draftEntries
      .filter((e) => e.name && e.dollars)
      .map((e) => ({
        memberId: e.memberId,
        categoryId: e.categoryId,
        type: e.type as 'asset' | 'liability',
        name: e.name,
        value: e.type === 'liability'
          ? -dollarsToCents(parseFloat(e.dollars) || 0)
          : dollarsToCents(parseFloat(e.dollars) || 0),
      }));

    mutation.mutate({ date, note: note || undefined, entries });
  };

  const totals = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    const byMember: Record<string, { assets: number; liabilities: number }> = {};

    for (const e of draftEntries) {
      const cents = dollarsToCents(parseFloat(e.dollars) || 0);
      if (!byMember[e.memberId]) byMember[e.memberId] = { assets: 0, liabilities: 0 };
      if (e.type === 'asset') {
        totalAssets += cents;
        byMember[e.memberId].assets += cents;
      } else {
        totalLiabilities += cents;
        byMember[e.memberId].liabilities += cents;
      }
    }

    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, byMember };
  }, [draftEntries]);

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading snapshot...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/networth/snapshots" className="p-2 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Edit Snapshot</h2>
      </div>

      {/* Date & Note */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Monthly check-in"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Running totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-6 items-center text-sm">
        <div>
          <span className="text-gray-500">Total Assets:</span>{' '}
          <span className="font-semibold text-success-600">{formatCurrency(totals.totalAssets)}</span>
        </div>
        <div>
          <span className="text-gray-500">Total Liabilities:</span>{' '}
          <span className="font-semibold text-danger-600">{formatCurrency(totals.totalLiabilities)}</span>
        </div>
        <div>
          <span className="text-gray-500">Net Worth:</span>{' '}
          <span className="font-bold text-gray-900">{formatCurrency(totals.netWorth)}</span>
        </div>
      </div>

      {/* Per-member sections */}
      {members.map((member) => {
        const memberEntries = draftEntries.filter((e) => e.memberId === member.id);
        const memberAssets = memberEntries.filter((e) => e.type === 'asset');
        const memberLiabs = memberEntries.filter((e) => e.type === 'liability');
        const memberTotals = totals.byMember[member.id] || { assets: 0, liabilities: 0 };

        return (
          <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: member.color }} />
              <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
              <span className="text-sm text-gray-400 ml-auto">
                Net: {formatCurrency(memberTotals.assets - memberTotals.liabilities)}
              </span>
            </div>

            {/* Assets */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-success-600">Assets</h4>
                <button
                  onClick={() => addEntry(member.id, 'asset')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Asset
                </button>
              </div>
              {memberAssets.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 mb-2">
                  <select
                    value={entry.categoryId}
                    onChange={(e) => updateEntry(entry.key, 'categoryId', e.target.value)}
                    className="w-40 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {assetCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={entry.name}
                    placeholder="Item name"
                    onChange={(e) => updateEntry(entry.key, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={entry.dollars}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      onChange={(e) => updateEntry(entry.key, 'dollars', e.target.value)}
                      className="w-32 pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button onClick={() => removeEntry(entry.key)} className="p-2 text-gray-400 hover:text-danger-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Liabilities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-danger-600">Liabilities</h4>
                <button
                  onClick={() => addEntry(member.id, 'liability')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Liability
                </button>
              </div>
              {memberLiabs.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 mb-2">
                  <select
                    value={entry.categoryId}
                    onChange={(e) => updateEntry(entry.key, 'categoryId', e.target.value)}
                    className="w-40 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {liabilityCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={entry.name}
                    placeholder="Item name"
                    onChange={(e) => updateEntry(entry.key, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={entry.dollars}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      onChange={(e) => updateEntry(entry.key, 'dollars', e.target.value)}
                      className="w-32 pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button onClick={() => removeEntry(entry.key)} className="p-2 text-gray-400 hover:text-danger-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-5 h-5" />
          {mutation.isPending ? 'Saving...' : 'Update Snapshot'}
        </button>
      </div>
    </div>
  );
}
