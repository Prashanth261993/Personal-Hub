import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { centsToDollars, formatCurrency } from '@networth/shared';
import type { MetricsHistoryPoint } from '@networth/shared';

interface PriceTargetChartProps {
  data: MetricsHistoryPoint[];
}

export default function PriceTargetChart({ data }: PriceTargetChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--stocks-text-muted)] text-sm">
        Need at least 2 data points to show trend. Refresh or save more versions.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    price: d.currentPrice ? centsToDollars(d.currentPrice) : null,
    target: d.targetPrice ? centsToDollars(d.targetPrice) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5ec8ff" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#5ec8ff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#53f2c8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#53f2c8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,122,167,0.1)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#8ea2c7', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(99,122,167,0.2)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8ea2c7', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v}`}
          width={55}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(12,18,34,0.95)',
            border: '1px solid rgba(99,122,167,0.25)',
            borderRadius: '10px',
            fontSize: '0.82rem',
            color: '#d7e3f8',
          }}
          formatter={(value: number, name: string) => [
            `$${value.toFixed(2)}`,
            name === 'price' ? 'Share Price' : 'Analyst Target',
          ]}
          labelFormatter={(label: string) => label}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.78rem', color: '#8ea2c7' }}
          formatter={(value: string) => (value === 'price' ? 'Share Price' : 'Analyst Target')}
        />
        <Area
          type="monotone"
          dataKey="target"
          stroke="#53f2c8"
          strokeWidth={2}
          fill="url(#gradTarget)"
          dot={{ r: 3, fill: '#53f2c8' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#5ec8ff"
          strokeWidth={2}
          fill="url(#gradPrice)"
          dot={{ r: 3, fill: '#5ec8ff' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
