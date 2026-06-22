import { desc, eq } from 'drizzle-orm';
import type { HoldingChangeType, PositionSentiment, ScreenerMetrics } from '@networth/shared';
import { db } from '../../../db/index.js';
import { fundFilings, fundHoldings, stocks, stockMetricsCache } from '../../../db/schema.js';

const PUT = 'Put';

/** One security within a single filing, with bullish/bearish exposure split out. */
export interface SecurityPosition {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  shares: number;             // long share count (putCall = null lines)
  bullishValueCents: number;  // shares + calls
  bearishValueCents: number;  // puts
  totalValueCents: number;
  pctOfPortfolio: number;     // pct across all lines
  longPctOfPortfolio: number; // pct from long-share lines only (bullish conviction)
}

function keyOf(cusip: string, issuerName: string): string {
  return cusip || issuerName;
}

/**
 * Aggregate one filing's raw holdings by CUSIP, collapsing duplicate manager rows
 * and splitting exposure into bullish (shares + calls) vs bearish (puts).
 */
export function aggregateBySecurity(filingId: string): Map<string, SecurityPosition> {
  const rows = db.select().from(fundHoldings).where(eq(fundHoldings.filingId, filingId)).all();
  const map = new Map<string, SecurityPosition>();

  for (const r of rows) {
    const key = keyOf(r.cusip, r.issuerName);
    let pos = map.get(key);
    if (!pos) {
      pos = {
        cusip: r.cusip,
        issuerName: r.issuerName,
        ticker: r.ticker,
        stockId: r.stockId,
        shares: 0,
        bullishValueCents: 0,
        bearishValueCents: 0,
        totalValueCents: 0,
        pctOfPortfolio: 0,
        longPctOfPortfolio: 0,
      };
      map.set(key, pos);
    }
    if (!pos.ticker && r.ticker) {
      pos.ticker = r.ticker;
      pos.stockId = r.stockId;
    }

    if (r.putCall === PUT) {
      pos.bearishValueCents += r.valueCents;
    } else {
      pos.bullishValueCents += r.valueCents;
      if (!r.putCall) {
        // Long share line (not an option) — the real equity stake.
        pos.shares += r.shares;
        pos.longPctOfPortfolio += r.pctOfPortfolio;
      }
    }
    pos.totalValueCents += r.valueCents;
    pos.pctOfPortfolio += r.pctOfPortfolio;
  }

  return map;
}

/** Classify directional stance once puts are treated as bearish. */
export function sentimentOf(bullishValueCents: number, bearishValueCents: number): PositionSentiment {
  const total = bullishValueCents + bearishValueCents;
  if (total <= 0) return 'neutral';
  if (bullishValueCents > 0 && bearishValueCents > 0) {
    if (bearishValueCents / total >= 0.9) return 'bearish';
    if (bullishValueCents / total >= 0.9) return 'bullish';
    return 'mixed';
  }
  return bearishValueCents > 0 ? 'bearish' : 'bullish';
}

/** A fund's latest two filings (for quarter-over-quarter comparison). */
export function latestTwoFilings(fundId: string): {
  latest: typeof fundFilings.$inferSelect | null;
  previous: typeof fundFilings.$inferSelect | null;
} {
  const rows = db
    .select()
    .from(fundFilings)
    .where(eq(fundFilings.fundId, fundId))
    .orderBy(desc(fundFilings.periodOfReport))
    .all();
  return { latest: rows[0] ?? null, previous: rows[1] ?? null };
}

export interface MoveClassification {
  changeType: HoldingChangeType;
  sharesChangePercent: number | null;
}

/**
 * Classify a security's quarter-over-quarter move. Uses the long-share count as the
 * primary size metric (the real equity stake); falls back to total value for
 * option-only positions where share counts are zero on both sides.
 */
export function classifyMove(
  from: SecurityPosition | undefined,
  to: SecurityPosition | undefined,
): MoveClassification {
  const hasFrom = !!from;
  const hasTo = !!to;
  if (!hasFrom && hasTo) return { changeType: 'new', sharesChangePercent: null };
  if (hasFrom && !hasTo) return { changeType: 'exit', sharesChangePercent: -100 };

  const fromShares = from?.shares ?? 0;
  const toShares = to?.shares ?? 0;

  if (fromShares > 0 || toShares > 0) {
    const diff = toShares - fromShares;
    const pct = fromShares > 0 ? (diff / fromShares) * 100 : null;
    if (diff > 0) return { changeType: 'add', sharesChangePercent: pct };
    if (diff < 0) return { changeType: 'trim', sharesChangePercent: pct };
    return { changeType: 'hold', sharesChangePercent: 0 };
  }

  // Option-only position: compare total value instead.
  const fromVal = from?.totalValueCents ?? 0;
  const toVal = to?.totalValueCents ?? 0;
  const diff = toVal - fromVal;
  const pct = fromVal > 0 ? (diff / fromVal) * 100 : null;
  if (diff > 0) return { changeType: 'add', sharesChangePercent: pct };
  if (diff < 0) return { changeType: 'trim', sharesChangePercent: pct };
  return { changeType: 'hold', sharesChangePercent: 0 };
}

/**
 * Build effective fundamental metrics for a tracked stock (manual overrides win over
 * cached API values). Returns null for stocks with no metric data at all.
 */
export function buildMetricsMap(stockIds: string[]): Map<string, ScreenerMetrics> {
  const out = new Map<string, ScreenerMetrics>();
  const unique = [...new Set(stockIds.filter(Boolean))];
  if (unique.length === 0) return out;

  for (const id of unique) {
    const stock = db.select().from(stocks).where(eq(stocks.id, id)).get();
    if (!stock) continue;
    const cache = db
      .select()
      .from(stockMetricsCache)
      .where(eq(stockMetricsCache.stockId, id))
      .get();

    const currentPriceCents = stock.manualCurrentPrice ?? cache?.currentPrice ?? null;
    const targetPriceCents = stock.manualTargetPrice ?? cache?.analystTargetPrice ?? null;
    const upsidePct =
      currentPriceCents && currentPriceCents > 0 && targetPriceCents != null
        ? ((targetPriceCents - currentPriceCents) / currentPriceCents) * 100
        : null;

    out.set(id, {
      currentPriceCents,
      targetPriceCents,
      upsidePct,
      peRatio: stock.manualPeRatio ?? cache?.peRatio ?? null,
      pbRatio: stock.manualPbRatio ?? cache?.pbRatio ?? null,
      psRatio: stock.manualPsRatio ?? cache?.psRatio ?? null,
      epsGrowth: stock.manualEpsGrowth ?? cache?.epsGrowth ?? null,
      marketCap: cache?.marketCap ?? null,
      beta: cache?.beta ?? null,
    });
  }
  return out;
}
