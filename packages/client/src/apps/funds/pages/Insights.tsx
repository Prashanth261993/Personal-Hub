import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import type {
  BearishSignal,
  ConcentratedBet,
  ConsensusMove,
  FundMoveRef,
  HoldingChangeType,
} from '@networth/shared';
import { fetchInsights } from '../api';

function compactCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

const CHANGE_STYLES: Record<HoldingChangeType, string> = {
  new: 'bg-emerald-600 text-white',
  add: 'bg-emerald-50 text-emerald-700',
  trim: 'bg-amber-50 text-amber-700',
  exit: 'bg-rose-50 text-rose-700',
  hold: 'bg-gray-100 text-gray-500',
};

const CHANGE_LABELS: Record<HoldingChangeType, string> = {
  new: 'New',
  add: 'Added',
  trim: 'Trimmed',
  exit: 'Exited',
  hold: 'Held',
};

function signedCurrency(cents: number): string {
  return `${cents >= 0 ? '+' : '-'}${compactCurrency(Math.abs(cents))}`;
}

function IssuerCell({
  issuerName,
  ticker,
  stockId,
  cusip,
}: {
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  cusip: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{issuerName}</span>
        {stockId ? (
          <Link
            to={`/stocks/${stockId}`}
            className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-mono hover:bg-primary-100 inline-flex items-center gap-1"
          >
            {ticker ?? 'View'} <ExternalLink className="w-3 h-3" />
          </Link>
        ) : ticker ? (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{ticker}</span>
        ) : null}
      </div>
      <p className="text-xs text-gray-300 font-mono mt-0.5">{cusip}</p>
    </div>
  );
}

function FundChips({ funds, labeled = false }: { funds: FundMoveRef[]; labeled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {funds.map((f) => (
        <Link
          key={f.fundId}
          to={`/funds/${f.fundId}`}
          className={`text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1 hover:opacity-80 ${CHANGE_STYLES[f.changeType]}`}
          title={`${CHANGE_LABELS[f.changeType]} · ${compactCurrency(f.toValueCents)} · ${f.toPctOfPortfolio.toFixed(1)}%${
            f.sharesChangePercent != null ? ` · ${f.sharesChangePercent >= 0 ? '+' : ''}${f.sharesChangePercent.toFixed(0)}% shares` : ''
          }${f.valueChangeCents != null ? ` · ${signedCurrency(f.valueChangeCents)} value` : ''}`}
        >
          {f.fundName}
          {labeled && <span className="opacity-70">· {CHANGE_LABELS[f.changeType]}</span>}
        </Link>
      ))}
    </div>
  );
}

function activityCounts(funds: FundMoveRef[]): Record<HoldingChangeType, number> {
  const counts: Record<HoldingChangeType, number> = { new: 0, add: 0, trim: 0, exit: 0, hold: 0 };
  for (const f of funds) counts[f.changeType] += 1;
  return counts;
}

function ActivityBadges({ funds }: { funds: FundMoveRef[] }) {
  const counts = activityCounts(funds);
  const order: HoldingChangeType[] = ['new', 'add', 'trim', 'exit', 'hold'];
  const visible = order.filter((t) => counts[t] > 0);
  if (visible.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((t) => (
        <span key={t} className={`text-[11px] px-1.5 py-0.5 rounded ${CHANGE_STYLES[t]}`}>
          {counts[t]} {CHANGE_LABELS[t].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function TrackedActivityTable({ rows }: { rows: ConsensusMove[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-8 text-sm text-gray-400 text-center">No tracked names moved this quarter.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="px-6 py-3 font-medium">Issuer</th>
            <th className="px-4 py-3 font-medium">Activity</th>
            <th className="px-4 py-3 font-medium text-right">Total Value</th>
            <th className="px-6 py-3 font-medium">Funds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cusip} className="border-b border-gray-50 hover:bg-amber-50/40 align-top">
              <td className="px-6 py-3">
                <IssuerCell issuerName={r.issuerName} ticker={r.ticker} stockId={r.stockId} cusip={r.cusip} />
              </td>
              <td className="px-4 py-3">
                <ActivityBadges funds={r.funds} />
              </td>
              <td className="px-4 py-3 text-right text-gray-900">{compactCurrency(r.totalValueCents)}</td>
              <td className="px-6 py-3">
                <FundChips funds={r.funds} labeled />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsensusTable({ rows }: { rows: ConsensusMove[] }) {
  if (rows.length === 0) {
    return <p className="px-6 py-8 text-sm text-gray-400 text-center">Nothing here this quarter.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="px-6 py-3 font-medium">Issuer</th>
            <th className="px-4 py-3 font-medium text-right"># Funds</th>
            <th className="px-4 py-3 font-medium text-right">Total Value</th>
            <th className="px-6 py-3 font-medium">Funds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cusip} className="border-b border-gray-50 hover:bg-amber-50/40 align-top">
              <td className="px-6 py-3">
                <IssuerCell issuerName={r.issuerName} ticker={r.ticker} stockId={r.stockId} cusip={r.cusip} />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.fundCount}</td>
              <td className="px-4 py-3 text-right text-gray-900">{compactCurrency(r.totalValueCents)}</td>
              <td className="px-6 py-3">
                <FundChips funds={r.funds} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        {icon}
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Insights() {
  const { data, isLoading } = useQuery({
    queryKey: ['funds-insights'],
    queryFn: fetchInsights,
  });

  return (
    <div className="space-y-6">
      <Link to="/funds" className="text-sm text-gray-400 hover:text-amber-600 inline-flex items-center gap-1">
        Funds
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">13F Insights</h2>
            <p className="text-sm text-gray-400">
              Cross-fund signals from the latest filings
              {data?.quarterLabel ? ` · ${data.quarterLabel}` : ''}. Research candidates, not buy/sell advice.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-6 text-sm text-gray-400">Crunching filings…</p>
      ) : !data ? (
        <p className="px-6 py-6 text-sm text-gray-400">No insights available.</p>
      ) : (
        <div className="space-y-6">
          <SectionCard
            icon={<Sparkles className="w-5 h-5 text-emerald-600" />}
            title="New Consensus Buys"
            subtitle="Brand-new positions opened by two or more funds this quarter."
          >
            <ConsensusTable rows={data.newConsensus} />
          </SectionCard>

          <SectionCard
            icon={<ArrowUpRight className="w-5 h-5 text-emerald-600" />}
            title="Cluster Buying"
            subtitle="Securities multiple funds bought or added to."
          >
            <ConsensusTable rows={data.clusterBuys} />
          </SectionCard>

          <SectionCard
            icon={<Target className="w-5 h-5 text-amber-600" />}
            title="Tracked Stock Activity"
            subtitle="How the funds moved on names you already follow — added, trimmed, or exited."
          >
            <TrackedActivityTable rows={data.trackedOverlap} />
          </SectionCard>

          <SectionCard
            icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
            title="Bearish Activity"
            subtitle="Securities where funds hold put (downside) exposure."
          >
            {data.bearishActivity.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No put exposure detected.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Issuer</th>
                      <th className="px-4 py-3 font-medium text-right"># Funds</th>
                      <th className="px-4 py-3 font-medium text-right">Put Value</th>
                      <th className="px-6 py-3 font-medium">Funds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bearishActivity.map((b: BearishSignal) => (
                      <tr key={b.cusip} className="border-b border-gray-50 hover:bg-rose-50/30 align-top">
                        <td className="px-6 py-3">
                          <IssuerCell issuerName={b.issuerName} ticker={b.ticker} stockId={b.stockId} cusip={b.cusip} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{b.fundCount}</td>
                        <td className="px-4 py-3 text-right text-rose-600">{compactCurrency(b.putValueCents)}</td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1">
                            {b.funds.map((f) => (
                              <Link
                                key={f.fundId}
                                to={`/funds/${f.fundId}`}
                                className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
                                title={compactCurrency(f.putValueCents)}
                              >
                                {f.fundName}
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<ArrowDownRight className="w-5 h-5 text-rose-600" />}
            title="Cluster Exits & Trims"
            subtitle="Securities multiple funds sold out of or reduced."
          >
            <ConsensusTable rows={data.clusterExits} />
          </SectionCard>

          <SectionCard
            icon={<Users className="w-5 h-5 text-amber-600" />}
            title="Concentrated Bets"
            subtitle="Single-fund positions that dominate that manager's portfolio."
          >
            {data.concentratedBets.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No concentrated positions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Issuer</th>
                      <th className="px-4 py-3 font-medium">Fund</th>
                      <th className="px-4 py-3 font-medium text-right">% of Portfolio</th>
                      <th className="px-4 py-3 font-medium text-right">Value</th>
                      <th className="px-4 py-3 font-medium">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.concentratedBets.map((c: ConcentratedBet) => (
                      <tr
                        key={`${c.fundId}-${c.cusip}`}
                        className="border-b border-gray-50 hover:bg-amber-50/40 align-top"
                      >
                        <td className="px-6 py-3">
                          <IssuerCell issuerName={c.issuerName} ticker={c.ticker} stockId={c.stockId} cusip={c.cusip} />
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/funds/${c.fundId}`} className="text-amber-700 hover:underline">
                            {c.fundName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {c.pctOfPortfolio.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">{compactCurrency(c.valueCents)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                              c.sentiment === 'bullish'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : c.sentiment === 'bearish'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : c.sentiment === 'mixed'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {c.sentiment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
