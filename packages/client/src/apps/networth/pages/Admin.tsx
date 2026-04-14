import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMembers, updateMembers, fetchCategories, updateCategories } from '../api';
import type { FamilyMember, Category, CategoriesConfig } from '@networth/shared';
import { Plus, Trash2, Save, Users, Tag } from 'lucide-react';
import IconLookup from '../../../components/IconLookup';
import ConfirmModal from '../../../components/ConfirmModal';

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Admin() {
  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-bold text-gray-900">Admin / Configuration</h2>
      <MembersSection />
      <CategoriesSection />
      <IconLookup />
    </div>
  );
}

// ── Family Members ──

function MembersSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['members'], queryFn: fetchMembers });
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMembers,
    meta: { successMessage: 'Family members saved' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setDirty(false);
    },
  });

  const current = members ?? data?.members ?? [];

  const update = (updated: FamilyMember[]) => {
    setMembers(updated);
    setDirty(true);
  };

  const addMember = () => {
    update([...current, { id: generateId('member'), name: '', color: '#6366f1' }]);
  };

  const removeMember = (id: string) => {
    update(current.filter((m) => m.id !== id));
  };

  const updateField = (id: string, field: keyof FamilyMember, value: string) => {
    update(current.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const save = () => {
    mutation.mutate({ members: current });
  };

  if (isLoading) return <div className="text-gray-500">Loading members...</div>;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Family Members</h3>
        </div>
        <button
          onClick={addMember}
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="space-y-3">
        {current.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <input
              type="color"
              value={member.color}
              onChange={(e) => updateField(member.id, 'color', e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={member.name}
              placeholder="Member name"
              onChange={(e) => updateField(member.id, 'name', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={() => setConfirmRemoveId(member.id)}
              className="p-2 text-gray-400 hover:text-danger-500 transition-colors"
              title="Remove member"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {dirty && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Saving...' : 'Save Members'}
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmRemoveId !== null}
        title="Remove Member"
        message="Remove this family member? You'll need to save to apply the change."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemoveId) removeMember(confirmRemoveId);
          setConfirmRemoveId(null);
        }}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </section>
  );
}

// ── Categories ──

function CategoriesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const [categories, setCategories] = useState<CategoriesConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ type: 'asset' | 'liability'; id: string } | null>(null);

  const mutation = useMutation({
    mutationFn: updateCategories,
    meta: { successMessage: 'Categories saved' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDirty(false);
    },
  });

  const current = categories ?? data ?? { assetCategories: [], liabilityCategories: [] };

  const updateCats = (updated: CategoriesConfig) => {
    setCategories(updated);
    setDirty(true);
  };

  const addCategory = (type: 'asset' | 'liability') => {
    const key = type === 'asset' ? 'assetCategories' : 'liabilityCategories';
    const prefix = type === 'asset' ? 'asset' : 'liability';
    updateCats({
      ...current,
      [key]: [...current[key], { id: generateId(prefix), name: '', icon: 'circle' }],
    });
  };

  const removeCategory = (type: 'asset' | 'liability', id: string) => {
    const key = type === 'asset' ? 'assetCategories' : 'liabilityCategories';
    updateCats({
      ...current,
      [key]: current[key].filter((c) => c.id !== id),
    });
  };

  const updateCategory = (type: 'asset' | 'liability', id: string, field: keyof Category, value: string) => {
    const key = type === 'asset' ? 'assetCategories' : 'liabilityCategories';
    updateCats({
      ...current,
      [key]: current[key].map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    });
  };

  const save = () => {
    mutation.mutate(current);
  };

  if (isLoading) return <div className="text-gray-500">Loading categories...</div>;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Tag className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Asset Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-success-600">Asset Categories</h4>
            <button
              onClick={() => addCategory('asset')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {current.assetCategories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cat.name}
                  placeholder="Category name"
                  onChange={(e) => updateCategory('asset', cat.id, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  value={cat.icon}
                  placeholder="Icon name"
                  onChange={(e) => updateCategory('asset', cat.id, 'icon', e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => setConfirmRemove({ type: 'asset', id: cat.id })}
                  className="p-2 text-gray-400 hover:text-danger-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Liability Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-danger-600">Liability Categories</h4>
            <button
              onClick={() => addCategory('liability')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {current.liabilityCategories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cat.name}
                  placeholder="Category name"
                  onChange={(e) => updateCategory('liability', cat.id, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  value={cat.icon}
                  placeholder="Icon name"
                  onChange={(e) => updateCategory('liability', cat.id, 'icon', e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => setConfirmRemove({ type: 'liability', id: cat.id })}
                  className="p-2 text-gray-400 hover:text-danger-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dirty && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Saving...' : 'Save Categories'}
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmRemove !== null}
        title="Remove Category"
        message="Remove this category? You'll need to save to apply the change."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove) removeCategory(confirmRemove.type, confirmRemove.id);
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </section>
  );
}
