import { Router, Request, Response } from 'express';
import { eq, isNull, sql } from 'drizzle-orm';
import type {
  CusipMapping,
  FundsMappingsResponse,
  UnmappedSecurity,
  UpsertMappingRequest,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { cusipMap, fundHoldings, stocks } from '../../../db/schema.js';

const router = Router();

// GET /api/funds/mappings — unmapped securities + existing CUSIP→ticker mappings
router.get('/mappings', (_req: Request, res: Response) => {
  try {
    // Aggregate holdings with no ticker yet, grouped by CUSIP.
    const unmappedRows = db
      .select({
        cusip: fundHoldings.cusip,
        issuerName: sql<string>`max(${fundHoldings.issuerName})`,
        holdingCount: sql<number>`count(*)`,
        fundCount: sql<number>`count(distinct ${fundHoldings.filingId})`,
        totalValueCents: sql<number>`sum(${fundHoldings.valueCents})`,
      })
      .from(fundHoldings)
      .where(isNull(fundHoldings.ticker))
      .groupBy(fundHoldings.cusip)
      .all();

    const unmapped: UnmappedSecurity[] = unmappedRows
      .filter((r) => r.cusip)
      .map((r) => ({
        cusip: r.cusip,
        issuerName: r.issuerName,
        holdingCount: Number(r.holdingCount) || 0,
        fundCount: Number(r.fundCount) || 0,
        totalValueCents: Number(r.totalValueCents) || 0,
      }))
      .sort((a, b) => b.totalValueCents - a.totalValueCents);

    // Existing mappings, enriched with a sample issuer name + linked stock id.
    const mapRows = db.select().from(cusipMap).all();
    const mapped: CusipMapping[] = mapRows
      .map((m) => {
        const sample = db
          .select({ issuerName: fundHoldings.issuerName, stockId: fundHoldings.stockId })
          .from(fundHoldings)
          .where(eq(fundHoldings.cusip, m.cusip))
          .limit(1)
          .get();
        return {
          cusip: m.cusip,
          ticker: m.ticker,
          source: m.source,
          updatedAt: m.updatedAt,
          issuerName: sample?.issuerName ?? null,
          stockId: sample?.stockId ?? null,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const response: FundsMappingsResponse = { unmapped, mapped };
    res.json(response);
  } catch (err) {
    console.error('Error fetching mappings:', err);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// POST /api/funds/mappings — create/update a CUSIP→ticker mapping (manual)
router.post('/mappings', (req: Request, res: Response) => {
  try {
    const body = req.body as UpsertMappingRequest;
    const cusip = body.cusip?.trim();
    const ticker = body.ticker?.trim().toUpperCase();

    if (!cusip) {
      res.status(400).json({ error: 'cusip is required' });
      return;
    }
    if (!ticker) {
      res.status(400).json({ error: 'ticker is required' });
      return;
    }

    const now = new Date().toISOString();

    // Resolve a tracked stock by symbol, if one exists.
    const stock = db.select().from(stocks).where(eq(stocks.symbol, ticker)).get();
    const stockId = stock?.id ?? null;

    db.insert(cusipMap)
      .values({ cusip, ticker, source: 'manual', updatedAt: now })
      .onConflictDoUpdate({
        target: cusipMap.cusip,
        set: { ticker, source: 'manual', updatedAt: now },
      })
      .run();

    // Apply to every holding sharing this CUSIP (current + historical).
    db.update(fundHoldings).set({ ticker, stockId }).where(eq(fundHoldings.cusip, cusip)).run();

    const mapping: CusipMapping = {
      cusip,
      ticker,
      source: 'manual',
      updatedAt: now,
      issuerName:
        db
          .select({ issuerName: fundHoldings.issuerName })
          .from(fundHoldings)
          .where(eq(fundHoldings.cusip, cusip))
          .limit(1)
          .get()?.issuerName ?? null,
      stockId,
    };
    res.status(201).json(mapping);
  } catch (err) {
    console.error('Error saving mapping:', err);
    res.status(500).json({ error: 'Failed to save mapping' });
  }
});

// DELETE /api/funds/mappings/:cusip — remove a mapping and unlink its holdings
router.delete('/mappings/:cusip', (req: Request, res: Response) => {
  try {
    const cusip = (req.params.cusip as string)?.trim();
    if (!cusip) {
      res.status(400).json({ error: 'cusip is required' });
      return;
    }

    db.delete(cusipMap).where(eq(cusipMap.cusip, cusip)).run();
    db.update(fundHoldings).set({ ticker: null, stockId: null }).where(eq(fundHoldings.cusip, cusip)).run();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting mapping:', err);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

export default router;
