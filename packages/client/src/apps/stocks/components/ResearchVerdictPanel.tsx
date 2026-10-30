import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, FileText, ShieldAlert, Target } from 'lucide-react';
import type { ResearchAction, ResearchPriceZone, StockResearchStatus } from '@networth/shared';
import { fetchStockDecisions } from '../api';

export const ACTION_META: Record<ResearchAction, { label: string; className: string }> = {
  'strong-buy': { label: 'Strong Buy', className: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40' },
  buy: { label: 'Buy', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  accumulate: { label: 'Accumulate', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
  hold: { label: 'Hold', className: 'bg-slate-500/20 text-slate-300 border-slate-400/30' },
  trim: { label: 'Trim', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  sell: { label: 'Sell', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
  avoid: { label: 'Avoid', className: 'bg-red-500/25 text-red-300 border-red-400/40' },
};

export const ZONE_META: Record<ResearchPriceZone, { label: string; color: string; text: string }> = {
  buy: { label: 'Buy zone', color: '#10b981', text: 'text-emerald-300' },
  accumulate: { label: 'Accumulate zone', color: '#22d3ee', text: 'text-cyan-300' },
  hold: { label: 'Hold zone', color: '#64748b', text: 'text-slate-300' },
  trim: { label: 'Trim zone', color: '#f59e0b', text: 'text-amber-300' },
  sell: { label: 'Sell zone', color: '#ef4444', text: 'text-red-300' },
};

const SIGNAL_LABEL = { strong: '🟢🟢🟢 Strong', neutral: '🟡🟡🟡 Neutral', caution: '🔴🔴 Caution' } as const;
const SCORE_LABELS: Record<string, string> = {
  quality: 'Quality', growth: 'Growth', valuation: 'Valuation', balanceSheet: 'Balance sheet',
  momentum: 'Momentum', sentiment: 'Sentiment', catalysts: 'Catalysts',
};

const usd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export function ActionBadge({ action, small = false }: { action: ResearchAction; small?: boolean }) {
  const meta = ACTION_META[action];
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm'} ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function ZoneLadder({ status }: { status: StockResearchStatus }) {
  const d = status.latest.decision;
  const bear = Math.min(...d.scenarios.map((s) => s.price12m));
  const bull = Math.max(...d.scenarios.map((s) => s.price12m));
  const candidates = [bear, bull, d.zones.buyBelow, d.zones.sellAbove, d.fairValue.low, d.fairValue.high, d.priceAtAnalysis];
  if (status.currentPrice !== null) candidates.push(status.currentPrice);
  const lo = Math.min(...candidates) * 0.95;
  const hi = Math.max(...candidates) * 1.05;
  const pos = (price: number) => `${Math.max(0, Math.min(100, ((price - lo) / (hi - lo)) * 100))}%`;

  const segments: Array<{ zone: ResearchPriceZone; from: number; to: number }> = [
    { zone: 'buy', from: lo, to: d.zones.buyBelow },
    { zone: 'accumulate', from: d.zones.buyBelow, to: d.zones.accumulateBelow },
    { zone: 'hold', from: d.zones.accumulateBelow, to: d.zones.trimAbove },
    { zone: 'trim', from: d.zones.trimAbove, to: d.zones.sellAbove },
    { zone: 'sell', from: d.zones.sellAbove, to: hi },
  ];

  return (
    <div className="mt-6">
      <div className="relative h-16">
        <div className="absolute inset-x-0 top-6 flex h-3 overflow-hidden rounded-full">
          {segments.map((seg) => (
            <div
              key={seg.zone}
              title={`${ZONE_META[seg.zone].label}: ${usd(seg.from)}–${usd(seg.to)}`}
              style={{ width: `${((seg.to - seg.from) / (hi - lo)) * 100}%`, background: ZONE_META[seg.zone].color, opacity: 0.55 }}
            />
          ))}
        </div>
        {/* fair value band */}
        <div
          className="absolute top-[18px] h-[28px] rounded-md border border-dashed border-[var(--stocks-accent-secondary)]"
          style={{ left: pos(d.fairValue.low), width: `calc(${pos(d.fairValue.high)} - ${pos(d.fairValue.low)})` }}
          title={`Fair value ${usd(d.fairValue.low)}–${usd(d.fairValue.high)} (mid ${usd(d.fairValue.mid)})`}
        />
        <div className="absolute top-0 -translate-x-1/2 text-[10px] text-[var(--stocks-accent-secondary)]" style={{ left: pos(d.fairValue.mid) }}>
          FV {usd(d.fairValue.mid)}
        </div>
        {status.currentPrice !== null && (
          <div className="absolute top-3 -translate-x-1/2 flex flex-col items-center" style={{ left: pos(status.currentPrice) }}>
            <div className="h-9 w-0.5 bg-[var(--stocks-text-strong)]" />
            <span className="mt-0.5 rounded bg-[var(--stocks-surface-strong)] px-1.5 text-[11px] font-semibold text-[var(--stocks-text-strong)]">
              Now {usd(status.currentPrice)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="stocks-metric-tile"><span className="text-emerald-300">Buy below</span><strong>{usd(d.zones.buyBelow)}</strong></div>
        <div className="stocks-metric-tile"><span className="text-cyan-300">Accumulate below</span><strong>{usd(d.zones.accumulateBelow)}</strong></div>
        <div className="stocks-metric-tile"><span className="text-amber-300">Trim above</span><strong>{usd(d.zones.trimAbove)}</strong></div>
        <div className="stocks-metric-tile"><span className="text-red-300">Sell above</span><strong>{usd(d.zones.sellAbove)}</strong></div>
      </div>
    </div>
  );
}

export default function ResearchVerdictPanel({ stockId, status }: { stockId: string; status: StockResearchStatus | null }) {
  const { data: decisions } = useQuery({
    queryKey: ['stock-decisions', stockId],
    queryFn: () => fetchStockDecisions(stockId),
    enabled: Boolean(status),
  });

  if (!status) {
    return (
      <div className="stocks-panel">
        <p className="stocks-eyebrow">Research Verdict</p>
        <h2 className="stocks-panel-title">No decision on file</h2>
        <p className="mt-2 text-sm text-[var(--stocks-text-muted)]">
          Run <code>/research-stock</code> on this ticker to produce valuation models, price scenarios, price zones and a buy/hold/sell verdict.
        </p>
      </div>
    );
  }

  const d = status.latest.decision;
  const zone = status.priceZone ? ZONE_META[status.priceZone] : null;
  const changeSinceAnalysis = status.currentPrice !== null ? ((status.currentPrice - d.priceAtAnalysis) / d.priceAtAnalysis) * 100 : null;
  const stale = status.daysSinceAnalysis > 90;

  return (
    <div className="stocks-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="stocks-eyebrow">Research Verdict · as of {d.asOf} ({status.daysSinceAnalysis}d ago)</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ActionBadge action={d.action} />
            <span className="stocks-badge capitalize">{d.conviction} conviction</span>
            <span className="text-sm text-[var(--stocks-text-muted)]">{SIGNAL_LABEL[d.signal]}</span>
            {zone && <span className={`text-sm font-semibold ${zone.text}`}>● Now in {zone.label.toLowerCase()}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          {status.belowReviewPrice && (
            <span className="inline-flex items-center gap-1 text-red-300"><ShieldAlert className="w-3.5 h-3.5" /> Below review price {d.reviewPriceBelow !== null ? usd(d.reviewPriceBelow) : ''} — re-underwrite thesis</span>
          )}
          {status.reviewDue && (
            <span className="inline-flex items-center gap-1 text-amber-300"><CalendarClock className="w-3.5 h-3.5" /> Review due ({d.nextReviewDate})</span>
          )}
          {stale && (
            <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> Verdict is {status.daysSinceAnalysis} days old — refresh recommended</span>
          )}
          {d.reportPath && (
            <span className="inline-flex items-center gap-1 text-[var(--stocks-text-muted)]"><FileText className="w-3.5 h-3.5" /> {d.reportPath}</span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="stocks-metric-tile"><span>Fair value (mid)</span><strong>{usd(d.fairValue.mid)}</strong></div>
        <div className="stocks-metric-tile"><span>FV range</span><strong>{usd(d.fairValue.low)}–{usd(d.fairValue.high)}</strong></div>
        <div className="stocks-metric-tile"><span>Upside to FV</span><strong className={status.fairValueUpsidePercent !== null && status.fairValueUpsidePercent < 0 ? 'text-red-300' : ''}>{status.fairValueUpsidePercent !== null ? pct(status.fairValueUpsidePercent) : '—'}</strong></div>
        <div className="stocks-metric-tile"><span>E[12m] price</span><strong>{usd(d.expectedPrice12m)}</strong></div>
        <div className="stocks-metric-tile"><span>Price at analysis</span><strong>{usd(d.priceAtAnalysis)}</strong></div>
        <div className="stocks-metric-tile"><span>Move since</span><strong className={changeSinceAnalysis !== null && changeSinceAnalysis < 0 ? 'text-red-300' : 'text-emerald-300'}>{changeSinceAnalysis !== null ? pct(changeSinceAnalysis) : '—'}</strong></div>
      </div>

      <ZoneLadder status={status} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div>
          <p className="stocks-eyebrow mb-2"><Target className="inline w-3.5 h-3.5 mr-1" />Scenarios (12m · 3y)</p>
          <div className="space-y-2">
            {d.scenarios.map((s) => (
              <div key={s.name} className="rounded-lg border border-[var(--stocks-border)] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                  <span className="capitalize font-medium text-[var(--stocks-text-strong)]">{s.name} · {Math.round(s.probability * 100)}%</span>
                  <span className="text-[var(--stocks-text)]">{usd(s.price12m)}{s.price3y !== null ? ` · ${usd(s.price3y)}` : ''}</span>
                </div>
                {s.driver && <p className="mt-0.5 text-xs text-[var(--stocks-text-muted)]">{s.driver}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="stocks-eyebrow mb-2"><ShieldAlert className="inline w-3.5 h-3.5 mr-1" />Thesis breakers</p>
          <ul className="space-y-1.5 text-sm text-[var(--stocks-text)] list-disc pl-5">
            {d.thesisBreakers.length > 0 ? d.thesisBreakers.map((t) => <li key={t}>{t}</li>) : <li className="text-[var(--stocks-text-muted)]">None recorded</li>}
          </ul>
          {d.reviewPriceBelow !== null && (
            <p className="mt-3 text-xs text-[var(--stocks-text-muted)]">Price review level: close below {usd(d.reviewPriceBelow)}</p>
          )}
        </div>

        <div>
          <p className="stocks-eyebrow mb-2">Scorecard (−2 … +2)</p>
          <div className="space-y-1.5">
            {Object.keys(SCORE_LABELS).filter((key) => key in d.scorecard).map((key) => [key, d.scorecard[key as keyof typeof d.scorecard]] as const).map(([key, score]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-28 text-[var(--stocks-text-muted)]">{SCORE_LABELS[key] ?? key}</span>
                <div className="relative h-2 flex-1 rounded-full bg-[var(--stocks-border)]">
                  <div className="absolute top-0 left-1/2 h-2 w-px bg-[var(--stocks-border-strong)]" />
                  <div
                    className={`absolute top-0 h-2 rounded-full ${(score ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    style={(score ?? 0) >= 0
                      ? { left: '50%', width: `${((score ?? 0) / 2) * 50}%` }
                      : { right: '50%', width: `${(Math.abs(score ?? 0) / 2) * 50}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[var(--stocks-text-strong)]">{(score ?? 0) > 0 ? `+${score}` : score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {decisions && decisions.length > 1 && (
        <div className="mt-6">
          <p className="stocks-eyebrow mb-2">Decision timeline</p>
          <div className="space-y-2">
            {decisions.map((rec) => {
              const r = rec.decision;
              const since = status.currentPrice !== null ? ((status.currentPrice - r.priceAtAnalysis) / r.priceAtAnalysis) * 100 : null;
              return (
                <div key={rec.id} className="stocks-history-item flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--stocks-text-muted)] w-24">{r.asOf}</span>
                    <ActionBadge action={r.action} small />
                    <span className="text-xs text-[var(--stocks-text-muted)] capitalize">{r.mode} · {r.conviction}</span>
                  </div>
                  <div className="text-[var(--stocks-text)]">
                    @ {usd(r.priceAtAnalysis)} · FV {usd(r.fairValue.mid)} · E[12m] {usd(r.expectedPrice12m)}
                    {since !== null && <span className={`ml-2 ${since >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{pct(since)} since</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-5 text-[11px] text-[var(--stocks-text-muted)]">
        AI-generated personal research — model outputs built on stated assumptions, not advice from a licensed professional. Zones are evaluated against the last cached price.
      </p>
    </div>
  );
}
