import { Router, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import type { FundsScreenerResponse, ScreenerFundRef, ScreenerRow } from '@networth/shared';
import { db } from '../../../db/index.js';
import { funds, fundFilings, fundHoldings } from '../../../db/schema.js';

const router = Router();

interface Accumulator {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  totalValueCents: number;
  pctSum: number;
  funds: Map<string, ScreenerFundRef>;
}

// GET /api/funds/screener — aggregate latest-filing holdings across every tracked fund
router.get('/screener', (_req: Request, res: Response) => {
  try {
    const fundRows = db.select().from(funds).where(eq(funds.status, 'active')).all();
    const byCusip = new Map<string, Accumulator>();

    for (const fund of fundRows) {
      const latest = db
        .select()
        .from(fundFilings)
        .where(eq(fundFilings.fundId, fund.id))
        .orderBy(desc(fundFilings.periodOfReport))
        .limit(1)
        .get();
      if (!latest) continue;

      const holdings = db
        .select()
        .from(fundHoldings)
        .where(eq(fundHoldings.filingId, latest.id))
        .all();

      // Aggregate this fund's own holdings by CUSIP first (manager dupes).
      const perFund = new Map<string, { value: number; pct: number; row: typeof holdings[number] }>();
      for (const h of holdings) {
        const key = h.cusip || h.issuerName;
        const existing = perFund.get(key);
        if (existing) {
          existing.value += h.valueCents;
          existing.pct += h.pctOfPortfolio;
        } else {
          perFund.set(key, { value: h.valueCents, pct: h.pctOfPortfolio, row: h });
        }
      }

      for (const [key, agg] of perFund) {
        let acc = byCusip.get(key);
        if (!acc) {
          acc = {
            cusip: agg.row.cusip,
            issuerName: agg.row.issuerName,
            ticker: agg.row.ticker,
            stockId: agg.row.stockId,
            totalValueCents: 0,
            pctSum: 0,
            funds: new Map(),
          };
          byCusip.set(key, acc);
        }
        if (!acc.ticker && agg.row.ticker) acc.ticker = agg.row.ticker;
        if (!acc.stockId && agg.row.stockId) acc.stockId = agg.row.stockId;
        acc.totalValueCents += agg.value;
        acc.pctSum += agg.pct;
        acc.funds.set(fund.id, {
          fundId: fund.id,
          fundName: fund.name,
          valueCents: agg.value,
          pctOfPortfolio: agg.pct,
        });
      }
    }

    const rows: ScreenerRow[] = Array.from(byCusip.values()).map((acc) => ({
      cusip: acc.cusip,
      issuerName: acc.issuerName,
      ticker: acc.ticker,
      stockId: acc.stockId,
      fundCount: acc.funds.size,
      totalValueCents: acc.totalValueCents,
      avgPctOfPortfolio: acc.funds.size > 0 ? acc.pctSum / acc.funds.size : 0,
      funds: Array.from(acc.funds.values()).sort((a, b) => b.valueCents - a.valueCents),
    }));

    rows.sort((a, b) => b.fundCount - a.fundCount || b.totalValueCents - a.totalValueCents);

    const response: FundsScreenerResponse = { rows };
    res.json(response);
  } catch (err) {
    console.error('Error building screener:', err);
    res.status(500).json({ error: 'Failed to build screener' });
  }
});

export default router;
