import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wallet, ListTodo, ArrowRight, LineChart } from 'lucide-react';
import { fetchInsightsSummary } from '../apps/networth/api';
import { fetchStats as fetchTodoStats } from '../apps/todo/api';
import { fetchStocksSummary } from '../apps/stocks/api';
import { formatCurrency, formatPercent } from '@networth/shared';

export default function Home() {
  const { data: summary } = useQuery({
    queryKey: ['insights-summary'],
    queryFn: fetchInsightsSummary,
  });

  const { data: todoStats } = useQuery({
    queryKey: ['todo-stats'],
    queryFn: fetchTodoStats,
  });

  const { data: stocksSummary } = useQuery({
    queryKey: ['stocks-summary'],
    queryFn: fetchStocksSummary,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Personal Hub</h2>
        <p className="text-gray-500 mt-1">Your personal tools, all in one place.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Net Worth Card */}
        <Link
          to="/networth"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary-600" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Net Worth Tracker</h3>
          <p className="text-sm text-gray-500 mb-4">Track assets, liabilities, and net worth over time.</p>
          {summary && summary.currentNetWorth !== 0 ? (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Current Net Worth</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.currentNetWorth)}</p>
              {summary.change !== 0 && (
                <p className={`text-xs mt-1 ${summary.change > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {summary.change > 0 ? '+' : ''}{formatCurrency(summary.change)} since last snapshot
                </p>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-400">Get started by creating your first snapshot</p>
            </div>
          )}
        </Link>

        {/* Planning / Todo Card */}
        <Link
          to="/todo"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
              <ListTodo className="w-6 h-6 text-violet-600" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Planning & Todos</h3>
          <p className="text-sm text-gray-500 mb-4">Task management, project planning, and goal setting.</p>
          {todoStats ? (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Open Tasks</p>
                  <p className="text-xl font-bold text-gray-900">{todoStats.totalOpen}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Completed Today</p>
                  <p className="text-xl font-bold text-green-600">{todoStats.completedToday}</p>
                </div>
              </div>
              {todoStats.currentStreak > 0 && (
                <p className="text-xs text-amber-600 mt-2">🔥 {todoStats.currentStreak} day streak</p>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-400">Get started by creating your first task</p>
            </div>
          )}
        </Link>

        {/* Stocks Card */}
        <Link
          to="/stocks"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center">
              <LineChart className="w-6 h-6 text-emerald-300" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Stocks Radar</h3>
          <p className="text-sm text-gray-500 mb-4">Track watchlist ideas, holdings, valuation drift, and research history.</p>
          {stocksSummary ? (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tracked Names</p>
                  <p className="text-xl font-bold text-gray-900">{stocksSummary.trackedCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Holdings</p>
                  <p className="text-xl font-bold text-gray-900">{stocksSummary.holdingsCount}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-600 mt-2">
                {stocksSummary.averageUpsidePercent !== null ? `${formatPercent(stocksSummary.averageUpsidePercent)} avg upside` : 'Add names to start tracking upside'}
              </p>
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-400">Get started by adding your first stock research record</p>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
