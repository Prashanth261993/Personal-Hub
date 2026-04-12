import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTrends, fetchInsightsSummary, fetchMembers, fetchGoals, updateGoals, fetchSnapshots, fetchCategories } from '../api';
import { centsToDollars, dollarsToCents, formatCurrency } from '@networth/shared';
import type { Goal } from '@networth/shared';
import { TrendingUp, Target, BarChart3, PieChart as PieChartIcon, Plus, Trash2 } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function Insights() {
  const { data: trends } = useQuery({ queryKey: ['trends'], queryFn: fetchTrends });
  const { data: summary } = useQuery({ queryKey: ['insights-summary'], queryFn: fetchInsightsSummary });
  const { data: membersConfig } = useQuery({ queryKey: ['members'], queryFn: fetchMembers });
  const { data: snapshots } = useQuery({ queryKey: ['snapshots'], queryFn: fetchSnapshots });

  const members = membersConfig?.members || [];
  const hasTrends = (trends || []).length > 0;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Insights & Analytics</h2>

      {!hasTrends ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">Add at least one snapshot to see insights.</p>
        </div>
      ) : (
        <>
          <TrendChart trends={trends!} members={members} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WaterfallChart snapshots={snapshots || []} />
            <AssetAllocationChart summary={summary!} />
          </div>
          <CategoryBreakdownChart summary={summary!} />
          <ProjectionsChart trends={trends!} members={members} />
          <GoalTracker summary={summary!} trends={trends!} />
        </>
      )}
    </div>
  );
}

// ── Net Worth Trend ──

function TrendChart({ trends, members }: { trends: any[]; members: any[] }) {
  const data = trends.map((t) => ({
    date: t.date,
    Combined: centsToDollars(t.combined),
    ...members.reduce(
      (acc, m) => ({ ...acc, [m.name]: centsToDollars(t.byMember[m.id] || 0) }),
      {} as Record<string, number>,
    ),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Net Worth Trend</h3>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Legend />
          <Line type="monotone" dataKey="Combined" stroke="#1f2937" strokeWidth={3} dot={{ r: 4 }} />
          {members.map((m) => (
            <Line
              key={m.id}
              type="monotone"
              dataKey={m.name}
              stroke={m.color}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Waterfall (Change Between Snapshots) ──

function WaterfallChart({ snapshots }: { snapshots: any[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Changes</h3>
        </div>
        <p className="text-gray-400 text-sm">Need at least 2 snapshots to show changes.</p>
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const data = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    data.push({
      period: `${prev.date} → ${curr.date}`,
      change: centsToDollars(curr.netWorth - prev.netWorth),
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Period-over-Period Change</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          <ReferenceLine y={0} stroke="#9ca3af" />
          <Bar dataKey="change">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.change >= 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Asset Allocation Pie ──

function AssetAllocationChart({ summary }: { summary: any }) {
  const assetData = (summary?.byCategory || [])
    .filter((c: any) => c.type === 'asset' && c.total > 0)
    .map((c: any) => ({ name: c.categoryName, value: centsToDollars(c.total) }));

  if (assetData.length === 0) return null;

  const total = assetData.reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Asset Allocation</h3>
      </div>
      <div className="flex items-center gap-6">
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={assetData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                {assetData.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {assetData.map((d: any, i: number) => {
            const pct = ((d.value / total) * 100).toFixed(1);
            return (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600 truncate flex-1">{d.name}</span>
                <span className="text-gray-900 font-medium tabular-nums">${d.value.toLocaleString()}</span>
                <span className="text-gray-400 tabular-nums w-12 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Category Breakdown Bar Chart ──

function CategoryBreakdownChart({ summary }: { summary: any }) {
  const data = (summary?.byCategory || [])
    .filter((c: any) => c.total !== 0)
    .map((c: any) => ({
      name: c.categoryName,
      value: centsToDollars(Math.abs(c.total)),
      type: c.type,
    }))
    .sort((a: any, b: any) => b.value - a.value);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="value">
            {data.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.type === 'asset' ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Projections ──

function ProjectionsChart({ trends, members }: { trends: any[]; members: any[] }) {
  if (trends.length < 2) return null;

  // Calculate average monthly growth rate from the trend data by dividing total change by elapsed months
  const firstDate = new Date(trends[0].date);
  const lastDate = new Date(trends[trends.length - 1].date);
  const firstValue = trends[0].combined;
  const lastValue = trends[trends.length - 1].combined;

  const totalChange = lastValue - firstValue;
  
  // Calculate elapsed months (roughly 30.44 days per month). Cap at minimum 1 to avoid dividing by 0.
  const elapsedMs = lastDate.getTime() - firstDate.getTime();
  const elapsedMonths = Math.max(elapsedMs / (1000 * 60 * 60 * 24 * 30.436875), 1);
  
  const avgMonthlyChange = totalChange / elapsedMonths;

  // Project 12 months ahead
  const projectionMonths = 12;
  const projectedData: { date: string; actual: number | null; projected: number | null }[] = trends.map((t) => ({
    date: t.date,
    actual: centsToDollars(t.combined),
    projected: null as number | null,
  }));

  for (let i = 1; i <= projectionMonths; i++) {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + i);
    projectedData.push({
      date: d.toISOString().slice(0, 10),
      actual: null,
      projected: centsToDollars(lastValue + avgMonthlyChange * i),
    });
  }

  // Add bridge point so the lines connect
  projectedData[trends.length - 1].projected = centsToDollars(lastValue);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">12-Month Projection</h3>
        <span className="text-xs text-gray-400 ml-2">
          Based on avg growth of {formatCurrency(Math.abs(avgMonthlyChange))}/mo
        </span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={projectedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => value !== null ? `$${value.toLocaleString()}` : 'N/A'} />
          <Legend />
          <Line type="monotone" dataKey="actual" stroke="#1f2937" strokeWidth={2} dot={{ r: 3 }} name="Actual" connectNulls={false} />
          <Line type="monotone" dataKey="projected" stroke="#818cf8" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} name="Projected" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Goal Tracker ──

function GoalTracker({ summary, trends }: { summary: any; trends: any[] }) {
  const queryClient = useQueryClient();
  const { data: goalsConfig } = useQuery({ queryKey: ['goals'], queryFn: fetchGoals });
  const { data: categoriesConfig } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const goals = goalsConfig?.goals || [];

  const allCategories = [
    ...(categoriesConfig?.assetCategories || []).map((c) => ({ ...c, type: 'asset' as const })),
    ...(categoriesConfig?.liabilityCategories || []).map((c) => ({ ...c, type: 'liability' as const })),
  ];

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTargetType, setNewTargetType] = useState<'netWorth' | 'category'>('netWorth');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateGoals,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const addGoal = () => {
    if (!newName || !newTarget || !newDate) return;
    if (newTargetType === 'category' && !newCategoryId) return;
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      name: newName,
      targetValue: dollarsToCents(parseFloat(newTarget)),
      targetDate: newDate,
      targetType: newTargetType,
      ...(newTargetType === 'category' ? { categoryId: newCategoryId } : {}),
      createdAt: new Date().toISOString(),
    };
    mutation.mutate({ goals: [...goals, goal] });
    setNewName('');
    setNewTarget('');
    setNewDate('');
    setNewTargetType('netWorth');
    setNewCategoryId('');
    setShowAdd(false);
  };

  const removeGoal = (id: string) => {
    mutation.mutate({ goals: goals.filter((g) => g.id !== id) });
  };

  const currentNetWorth = summary?.currentNetWorth || 0;

  function getCurrentValue(goal: Goal): number {
    if (goal.targetType === 'category' && goal.categoryId) {
      const cat = (summary?.byCategory || []).find((c: any) => c.categoryId === goal.categoryId);
      return cat ? Math.abs(cat.total) : 0;
    }
    return currentNetWorth;
  }

  function isLiabilityGoal(goal: Goal): boolean {
    if (goal.targetType !== 'category' || !goal.categoryId) return false;
    return allCategories.some((c) => c.id === goal.categoryId && c.type === 'liability');
  }

  function getCategoryName(categoryId: string): string | null {
    const cat = allCategories.find((c) => c.id === categoryId);
    return cat ? cat.name : null;
  }

  // Calculate projected date to reach goal based on average growth
  function projectedDate(goal: Goal): string | null {
    if (trends.length < 2) return null;

    const isLiability = isLiabilityGoal(goal);
    const useCategory = goal.targetType === 'category' && goal.categoryId;

    const values = trends.map((t) =>
      useCategory ? Math.abs(t.byCategory?.[goal.categoryId!] || 0) : t.combined,
    );

    const changes: number[] = [];
    for (let i = 1; i < values.length; i++) changes.push(values[i] - values[i - 1]);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    const current = getCurrentValue(goal);

    if (isLiability) {
      // For liabilities, value should be decreasing (avgChange < 0 means paying down)
      if (avgChange >= 0) return null;
      const remaining = current - goal.targetValue;
      if (remaining <= 0) return 'Reached!';
      const periodsNeeded = Math.ceil(remaining / Math.abs(avgChange));
      const lastDate = new Date(trends[trends.length - 1].date);
      lastDate.setMonth(lastDate.getMonth() + periodsNeeded);
      return lastDate.toISOString().slice(0, 10);
    } else {
      if (avgChange <= 0) return null;
      const remaining = goal.targetValue - current;
      if (remaining <= 0) return 'Reached!';
      const periodsNeeded = Math.ceil(remaining / avgChange);
      const lastDate = new Date(trends[trends.length - 1].date);
      lastDate.setMonth(lastDate.getMonth() + periodsNeeded);
      return lastDate.toISOString().slice(0, 10);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Goal Tracking</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Goal Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Reach $500k"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Track</label>
            <select
              value={newTargetType === 'category' ? newCategoryId : 'netWorth'}
              onChange={(e) => {
                if (e.target.value === 'netWorth') {
                  setNewTargetType('netWorth');
                  setNewCategoryId('');
                } else {
                  setNewTargetType('category');
                  setNewCategoryId(e.target.value);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="netWorth">Total Net Worth</option>
              {allCategories.length > 0 && (
                <>
                  <optgroup label="Asset Categories">
                    {allCategories.filter((c) => c.type === 'asset').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Liability Categories">
                    {allCategories.filter((c) => c.type === 'liability').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target ($)</label>
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="500000"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={addGoal}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Save Goal
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No goals set yet. Add one to track your progress!</p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const current = getCurrentValue(goal);
            const isLiability = isLiabilityGoal(goal);
            const progress = isLiability
              ? Math.min(100, Math.max(0, current <= goal.targetValue ? 100 : ((1 - (current - goal.targetValue) / current) * 100)))
              : Math.min(100, Math.max(0, (current / goal.targetValue) * 100));
            const projected = projectedDate(goal);
            const catName = goal.targetType === 'category' && goal.categoryId ? getCategoryName(goal.categoryId) : null;

            return (
              <div key={goal.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{goal.name}</span>
                    {catName && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{catName}</span>
                    )}
                    <span className="text-sm text-gray-400">
                      Target: {formatCurrency(goal.targetValue)} by {goal.targetDate}
                    </span>
                  </div>
                  <button onClick={() => setConfirmDeleteId(goal.id)} className="text-gray-400 hover:text-danger-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: progress >= 100 ? '#10B981' : '#4F46E5',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {isLiability
                      ? `${formatCurrency(current * 100)} remaining / ${formatCurrency(goal.targetValue)} target (${progress.toFixed(1)}%)`
                      : `${formatCurrency(current)} / ${formatCurrency(goal.targetValue)} (${progress.toFixed(1)}%)`
                    }
                  </span>
                  {projected && <span>Projected: {projected}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Delete Goal"
        message="Remove this goal? This cannot be undone."
        onConfirm={() => {
          if (confirmDeleteId) removeGoal(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
