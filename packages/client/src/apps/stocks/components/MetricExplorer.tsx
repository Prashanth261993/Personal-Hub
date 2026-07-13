import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { centsToDollars } from '@networth/shared';
import type { MetricsHistoryPoint } from '@networth/shared';

interface MetricExplorerProps {
  data: MetricsHistoryPoint[];
}

interface MetricOption {
  key: keyof MetricsHistoryPoint;
  label: string;
  format: 'currency' | 'ratio' | 'percent' | 'compact' | 'count';
  color: string;
}

const METRICS: MetricOption[] = [
  { key: 'currentPrice', label: 'Share Price', format: 'currency', color: '#5ec8ff' },
  { key: 'targetPrice', label: 'Target Price', format: 'currency', color: '#53f2c8' },
  { key: 'peRatio', label: 'P/E Ratio', format: 'ratio', color: '#f59e0b' },
  { key: 'forwardPe', label: 'Forward P/E', format: 'ratio', color: '#fbbf24' },
  { key: 'pegRatio', label: 'PEG Ratio', format: 'ratio', color: '#f97316' },
  { key: 'pbRatio', label: 'P/B Ratio', format: 'ratio', color: '#a78bfa' },
  { key: 'psRatio', label: 'P/S Ratio', format: 'ratio', color: '#fb923c' },
  { key: 'evToEbitda', label: 'EV / EBITDA', format: 'ratio', color: '#c084fc' },
  { key: 'evToRevenue', label: 'EV / Revenue', format: 'ratio', color: '#e879f9' },
  { key: 'epsGrowth', label: 'EPS Growth', format: 'percent', color: '#34d399' },
  { key: 'dilutedEpsTtm', label: 'Diluted EPS (TTM)', format: 'currency', color: '#4ade80' },
  { key: 'bookValue', label: 'Book Value / Share', format: 'currency', color: '#2dd4bf' },
  { key: 'dividendPerShare', label: 'Dividend / Share', format: 'currency', color: '#22d3ee' },
  { key: 'dividendYield', label: 'Dividend Yield', format: 'percent', color: '#38bdf8' },
  { key: 'profitMargin', label: 'Profit Margin', format: 'percent', color: '#60a5fa' },
  { key: 'operatingMarginTtm', label: 'Operating Margin', format: 'percent', color: '#818cf8' },
  { key: 'returnOnEquityTtm', label: 'Return on Equity', format: 'percent', color: '#a3e635' },
  { key: 'returnOnAssetsTtm', label: 'Return on Assets', format: 'percent', color: '#bef264' },
  { key: 'beta', label: 'Beta', format: 'ratio', color: '#f472b6' },
  { key: 'marketCap', label: 'Market Cap', format: 'compact', color: '#facc15' },
  { key: 'ebitda', label: 'EBITDA', format: 'compact', color: '#fde047' },
  { key: 'revenueTtm', label: 'Revenue (TTM)', format: 'compact', color: '#7dd3fc' },
  { key: 'grossProfitTtm', label: 'Gross Profit (TTM)', format: 'compact', color: '#5eead4' },
  { key: 'sharesOutstanding', label: 'Shares Outstanding', format: 'count', color: '#cbd5e1' },
];

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

function formatValue(value: number, format: MetricOption['format']): string {
  if (format === 'currency') return `$${centsToDollars(value).toFixed(2)}`;
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'compact') return `$${compactFmt.format(value)}`;
  if (format === 'count') return compactFmt.format(value);
  return value.toFixed(2);
}

function formatAxisValue(value: number, format: MetricOption['format']): string {
  if (format === 'currency') return `$${centsToDollars(value).toFixed(0)}`;
  if (format === 'percent') return `${value.toFixed(0)}%`;
  if (format === 'compact') return `$${compactFmt.format(value)}`;
  if (format === 'count') return compactFmt.format(value);
  return value.toFixed(1);
}

export default function MetricExplorer({ data }: MetricExplorerProps) {
  const [selectedKey, setSelectedKey] = useState<keyof MetricsHistoryPoint>('peRatio');

  const metric = METRICS.find((m) => m.key === selectedKey) ?? METRICS[0];

  const chartData = data
    .map((d) => ({
      date: d.date,
      value: d[metric.key] as number | null,
    }))
    .filter((d) => d.value !== null);

  // Compute summary stats
  const values = chartData.map((d) => d.value as number);
  const current = values.length > 0 ? values[values.length - 1] : null;
  const first = values.length > 0 ? values[0] : null;
  const min = values.length > 0 ? Math.min(...values) : null;
  const max = values.length > 0 ? Math.max(...values) : null;
  const delta = current !== null && first !== null ? current - first : null;

  return (
    <div className="flex flex-col h-full">
      {/* Metric selector */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value as keyof MetricsHistoryPoint)}
          className="stocks-field-select"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        {current !== null && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--stocks-text-strong)] font-semibold text-lg">
              {formatValue(current, metric.format)}
            </span>
            {delta !== null && delta !== 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                delta > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {delta > 0 ? '+' : ''}{formatValue(delta, metric.format)} from first
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats strip */}
      {values.length > 0 && (
        <div className="flex gap-4 mb-3 text-xs text-[var(--stocks-text-muted)]">
          {min !== null && <span>Low: <strong className="text-[var(--stocks-text)]">{formatValue(min, metric.format)}</strong></span>}
          {max !== null && <span>High: <strong className="text-[var(--stocks-text)]">{formatValue(max, metric.format)}</strong></span>}
          <span>Points: <strong className="text-[var(--stocks-text)]">{values.length}</strong></span>
        </div>
      )}

      {/* Chart */}
      {chartData.length < 2 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--stocks-text-muted)] text-sm">
          Need at least 2 data points. Save more versions to see trends.
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                tickFormatter={(v: number) => formatAxisValue(v, metric.format)}
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
                formatter={(value: number) => [formatValue(value, metric.format), metric.label]}
                labelFormatter={(label: string) => label}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={metric.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: metric.color, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: metric.color, fill: 'rgba(12,18,34,0.9)' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
