import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchInsightsSummary, fetchTrends, fetchMembers } from '../api';
import { formatCurrency, centsToDollars } from '@networth/shared';
import { TrendingUp, TrendingDown, Plus, ArrowRight } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

function BreakdownPanel({ title, data, colors }: { title: string; data: { name: string; value: number }[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0 || total === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center gap-6">
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {data.map((d, i) => {
            const pct = ((d.value / total) * 100).toFixed(1);
            return (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
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

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['insights-summary'],
    queryFn: fetchInsightsSummary,
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ['trends'],
    queryFn: fetchTrends,
  });

  const { data: membersConfig } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
  });

  if (loadingSummary || loadingTrends) {
    return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  }

  const isEmpty = !summary || summary.currentNetWorth === 0 && summary.byMember.length === 0;

  if (isEmpty) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Net Worth Tracker</h2>
        <p className="text-gray-500 mb-6">Get started by creating your first snapshot.</p>
        <Link
          to="/networth/snapshots/new"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create First Snapshot
        </Link>
      </div>
    );
  }

  // Prepare trend chart data
  const trendData = (trends || []).map((t) => ({
    date: t.date,
    Combined: centsToDollars(t.combined),
    ...(membersConfig?.members || []).reduce(
      (acc, m) => ({ ...acc, [m.name]: centsToDollars(t.byMember[m.id] || 0) }),
      {} as Record<string, number>,
    ),
  }));

  // Prepare pie chart data for asset categories
  const assetPieData = (summary?.byCategory || [])
    .filter((c) => c.type === 'asset' && c.total > 0)
    .map((c) => ({ name: c.categoryName, value: centsToDollars(c.total) }));

  const liabilityPieData = (summary?.byCategory || [])
    .filter((c) => c.type === 'liability' && c.total < 0)
    .map((c) => ({ name: c.categoryName, value: Math.abs(centsToDollars(c.total)) }));

  const isPositiveChange = (summary?.change || 0) >= 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <Link
          to="/networth/snapshots/new"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Snapshot
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Combined Net Worth */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Combined Net Worth</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary!.currentNetWorth)}</p>
          {summary!.previousNetWorth !== 0 && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${isPositiveChange ? 'text-success-600' : 'text-danger-600'}`}>
              {isPositiveChange ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{formatCurrency(Math.abs(summary!.change))}</span>
              <span>({summary!.changePercent.toFixed(1)}%)</span>
            </div>
          )}
        </div>

        {/* Per-member cards */}
        {summary!.byMember.map((m) => (
          <div key={m.memberId} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.memberColor }} />
              <p className="text-sm text-gray-500">{m.memberName}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(m.netWorth)}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Assets: {formatCurrency(m.totalAssets)}</span>
              <span>Liabilities: {formatCurrency(Math.abs(m.totalLiabilities))}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Net Worth Over Time</h3>
            <Link to="/networth/insights" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View Details <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
                }
              />
              <Line type="monotone" dataKey="Combined" stroke="#1f2937" strokeWidth={3} dot={{ r: 4 }} />
              {(membersConfig?.members || []).map((m, i) => (
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
      )}

      {/* Breakdown panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownPanel title="Asset Breakdown" data={assetPieData} colors={COLORS} />
        <BreakdownPanel title="Liability Breakdown" data={liabilityPieData} colors={COLORS.slice(3)} />
      </div>
    </div>
  );
}
