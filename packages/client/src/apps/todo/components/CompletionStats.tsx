import { useSpring, animated } from '@react-spring/web';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Flame, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { TodoStats } from '@networth/shared';

interface CompletionStatsProps {
  stats: TodoStats | undefined;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring({ val: value, from: { val: 0 }, config: { tension: 120, friction: 14 } });
  return <animated.span>{spring.val.to(v => Math.round(v))}</animated.span>;
}

export default function CompletionStats({ stats }: CompletionStatsProps) {
  if (!stats) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-50 rounded" />
      </div>
    );
  }

  const chartData = stats.completionsByDay.slice(-14).map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    count: d.count,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-green-500" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">Stats</h3>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Today</p>
          <p className="text-lg font-bold text-gray-900">
            <AnimatedNumber value={stats.completedToday} />
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">This Week</p>
          <p className="text-lg font-bold text-gray-900">
            <AnimatedNumber value={stats.completedThisWeek} />
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <p className="text-[10px] text-orange-600 uppercase tracking-wider">Streak</p>
          </div>
          <p className="text-lg font-bold text-orange-600">
            <AnimatedNumber value={stats.currentStreak} />
            <span className="text-xs font-normal ml-0.5">days</span>
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-gray-400" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Open</p>
          </div>
          <p className="text-lg font-bold text-gray-900">
            <AnimatedNumber value={stats.totalOpen} />
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
