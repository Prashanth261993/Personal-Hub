import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import type {
  FundsScreenerResponse,
  HoldingChangeType,
  PositionSentiment,
  ScreenerFundRef,
  ScreenerMetrics,
  ScreenerRow,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { funds } from '../../../db/schema.js';
import {
  aggregateBySecurity,
  buildMetricsMap,
  classifyMove,
  latestTwoFilings,
  sentimentOf,
  type SecurityPosition,
} from '../lib/aggregation.js';

const router = Router();

interface Accumulator {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  bullishValueCents: number;
  bearishValueCents: number;
  totalValueCents: number;
  pctSum: number;          // sum of total pct across funds (for avg)
  longPctSum: number;      // sum of long-share pct across funds (for conviction)
  fundsNew: number;
  fundsAdded: number;
  fundsTrimmed: number;
  fundsExited: number;
  fundsHold: number;
  maxSharesChangePercent: number | null;
  maxValueChangeCents: number | null;
  fromShares: number;      // aggregate prior shares (for net change %)
  toShares: number;        // aggregate current shares
  funds: Map<string, ScreenerFundRef>;
}

// GET /api/funds/screener — aggregate latest-filing holdings across every tracked fund
router.get('/screener', (_req: Request, res: Response) => {
  try {
    const fundRows = db.select().from(funds).where(eq(funds.status, 'active')).all();
    const byCusip = new Map<string, Accumulator>();

    for (const fund of fundRows) {
      const { latest, previous } = latestTwoFilings(fund.id);
      if (!latest) continue;

      const current = aggregateBySecurity(latest.id);
      const prior = previous ? aggregateBySecurity(previous.id) : new Map<string, SecurityPosition>();

      for (const [key, pos] of current) {
        const { changeType, sharesChangePercent } = classifyMove(prior.get(key), pos);
        const priorPos = prior.get(key);
        const valueChangeCents = priorPos ? pos.totalValueCents - priorPos.totalValueCents : null;

        let acc = byCusip.get(key);
        if (!acc) {
          acc = {
            cusip: pos.cusip,
            issuerName: pos.issuerName,
            ticker: pos.ticker,
            stockId: pos.stockId,
            bullishValueCents: 0,
            bearishValueCents: 0,
            totalValueCents: 0,
            pctSum: 0,
            longPctSum: 0,
            fundsNew: 0,
            fundsAdded: 0,
            fundsTrimmed: 0,
            fundsExited: 0,
            fundsHold: 0,
            maxSharesChangePercent: null,
            maxValueChangeCents: null,
            fromShares: 0,
            toShares: 0,
            funds: new Map(),
          };
          byCusip.set(key, acc);
        }
        if (!acc.ticker && pos.ticker) acc.ticker = pos.ticker;
        if (!acc.stockId && pos.stockId) acc.stockId = pos.stockId;

        acc.bullishValueCents += pos.bullishValueCents;
        acc.bearishValueCents += pos.bearishValueCents;
        acc.totalValueCents += pos.totalValueCents;
        acc.pctSum += pos.pctOfPortfolio;
        acc.longPctSum += pos.longPctOfPortfolio;
        acc.toShares += pos.shares;
        acc.fromShares += prior.get(key)?.shares ?? 0;

        if (changeType === 'new') acc.fundsNew += 1;
        else if (changeType === 'add') acc.fundsAdded += 1;
        else if (changeType === 'trim') acc.fundsTrimmed += 1;
        else if (changeType === 'hold') acc.fundsHold += 1;
        // 'exit' never appears here (security is present in the current filing).

        if (sharesChangePercent != null) {
          acc.maxSharesChangePercent =
            acc.maxSharesChangePercent == null
              ? sharesChangePercent
              : Math.max(acc.maxSharesChangePercent, sharesChangePercent);
        }
        if (valueChangeCents != null) {
          acc.maxValueChangeCents =
            acc.maxValueChangeCents == null
              ? valueChangeCents
              : Math.max(acc.maxValueChangeCents, valueChangeCents);
        }

        acc.funds.set(fund.id, {
          fundId: fund.id,
          fundName: fund.name,
          valueCents: pos.totalValueCents,
          pctOfPortfolio: pos.pctOfPortfolio,
          bullishValueCents: pos.bullishValueCents,
          bearishValueCents: pos.bearishValueCents,
          changeType: changeType as HoldingChangeType,
          sharesChangePercent,
          valueChangeCents,
        });
      }
    }

    // Resolve fundamental metrics for any tracked securities.
    const trackedIds = [...byCusip.values()].map((a) => a.stockId).filter((x): x is string => !!x);
    const metricsMap = buildMetricsMap(trackedIds);

    const rows: ScreenerRow[] = Array.from(byCusip.values()).map((acc) => {
      const fundCount = acc.funds.size;
      const sentiment: PositionSentiment = sentimentOf(acc.bullishValueCents, acc.bearishValueCents);
      const metrics: ScreenerMetrics | null = acc.stockId ? metricsMap.get(acc.stockId) ?? null : null;
      const netSharesChangePercent =
        acc.fromShares > 0 ? ((acc.toShares - acc.fromShares) / acc.fromShares) * 100 : null;

      return {
        cusip: acc.cusip,
        issuerName: acc.issuerName,
        ticker: acc.ticker,
        stockId: acc.stockId,
        isTracked: !!acc.stockId,
        fundCount,
        totalValueCents: acc.totalValueCents,
        bullishValueCents: acc.bullishValueCents,
        bearishValueCents: acc.bearishValueCents,
        sentiment,
        avgPctOfPortfolio: fundCount > 0 ? acc.pctSum / fundCount : 0,
        convictionPct: fundCount > 0 ? acc.longPctSum / fundCount : 0,
        fundsNew: acc.fundsNew,
        fundsAdded: acc.fundsAdded,
        fundsTrimmed: acc.fundsTrimmed,
        fundsExited: acc.fundsExited,
        fundsHold: acc.fundsHold,
        maxSharesChangePercent: acc.maxSharesChangePercent,
        maxValueChangeCents: acc.maxValueChangeCents,
        netSharesChangePercent,
        metrics,
        funds: Array.from(acc.funds.values()).sort((a, b) => b.valueCents - a.valueCents),
      };
    });

    rows.sort((a, b) => b.fundCount - a.fundCount || b.totalValueCents - a.totalValueCents);

    const response: FundsScreenerResponse = { rows };
    res.json(response);
  } catch (err) {
    console.error('Error building screener:', err);
    res.status(500).json({ error: 'Failed to build screener' });
  }
});

export default router;
