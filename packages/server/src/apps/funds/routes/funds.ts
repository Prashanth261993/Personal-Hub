import { Router, Request, Response } from 'express';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateFundRequest,
  Fund,
  FundDeltasResponse,
  FundDetailResponse,
  FundFiling,
  FundHolding,
  FundsDashboardRow,
  FundsHomeSummary,
  HoldingChangeType,
  HoldingDelta,
  LinkHoldingRequest,
  RefreshFundResponse,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { cusipMap, funds, fundFilings, fundHoldings, stocks } from '../../../db/schema.js';
import {
  getInfoTableHoldings,
  getRecent13Fs,
  padCik,
  quarterFromPeriod,
  resolveTickerByName,
} from '../lib/secEdgar.js';

const router = Router();

/** How many recent filings to backfill on each refresh (for QoQ deltas). */
const BACKFILL_LIMIT = 6;

function paramId(req: Request): string {
  return req.params.id as string;
}

/** Map of UPPERCASE stock symbol → stock id for active tracked stocks. */
function buildSymbolToStockId(): Map<string, string> {
  const map = new Map<string, string>();
  const rows = db.select({ id: stocks.id, symbol: stocks.symbol }).from(stocks).all();
  for (const r of rows) {
    if (r.symbol) map.set(r.symbol.toUpperCase(), r.id);
  }
  return map;
}

/**
 * Resolve ticker + tracked-stock id for a holding. Checks the cusip_map cache first,
 * then falls back to SEC company_tickers name matching (cached as 'auto').
 */
async function resolveLink(
  cusip: string,
  issuerName: string,
  symbolToStockId: Map<string, string>,
  now: string,
): Promise<{ ticker: string | null; stockId: string | null }> {
  let ticker: string | null = null;

  const mapped = cusip ? db.select().from(cusipMap).where(eq(cusipMap.cusip, cusip)).get() : undefined;
  if (mapped) {
    ticker = mapped.ticker;
  } else {
    const resolved = await resolveTickerByName(issuerName);
    if (resolved) {
      ticker = resolved;
      if (cusip) {
        db.insert(cusipMap)
          .values({ cusip, ticker, source: 'auto', updatedAt: now })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  const stockId = ticker ? symbolToStockId.get(ticker.toUpperCase()) ?? null : null;
  return { ticker, stockId };
}

function rowToFund(row: typeof funds.$inferSelect): Fund {
  return {
    id: row.id,
    cik: row.cik,
    name: row.name,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToFiling(row: typeof fundFilings.$inferSelect): FundFiling {
  return {
    id: row.id,
    fundId: row.fundId,
    accessionNumber: row.accessionNumber,
    periodOfReport: row.periodOfReport,
    quarter: row.quarter,
    filedAt: row.filedAt,
    totalValueCents: row.totalValueCents,
    positionCount: row.positionCount,
    createdAt: row.createdAt,
  };
}

function rowToHolding(row: typeof fundHoldings.$inferSelect): FundHolding {
  return {
    id: row.id,
    filingId: row.filingId,
    issuerName: row.issuerName,
    cusip: row.cusip,
    ticker: row.ticker,
    stockId: row.stockId,
    valueCents: row.valueCents,
    shares: row.shares,
    putCall: row.putCall,
    pctOfPortfolio: row.pctOfPortfolio,
    createdAt: row.createdAt,
  };
}

function latestFilingForFund(fundId: string): typeof fundFilings.$inferSelect | undefined {
  return db
    .select()
    .from(fundFilings)
    .where(eq(fundFilings.fundId, fundId))
    .orderBy(desc(fundFilings.periodOfReport))
    .limit(1)
    .get();
}

// GET /api/funds — tracked funds + latest filing summary
router.get('/', (_req: Request, res: Response) => {
  try {
    const fundRows = db.select().from(funds).orderBy(desc(funds.createdAt)).all();

    const rows: FundsDashboardRow[] = fundRows.map((f) => {
      const latest = latestFilingForFund(f.id);
      let topHoldingName: string | null = null;

      if (latest) {
        const top = db
          .select()
          .from(fundHoldings)
          .where(eq(fundHoldings.filingId, latest.id))
          .orderBy(desc(fundHoldings.valueCents))
          .limit(1)
          .get();
        topHoldingName = top?.issuerName ?? null;
      }

      return {
        id: f.id,
        cik: f.cik,
        name: f.name,
        status: f.status,
        lastSyncedAt: f.lastSyncedAt,
        latestQuarter: latest?.quarter ?? null,
        latestPeriodOfReport: latest?.periodOfReport ?? null,
        totalValueCents: latest?.totalValueCents ?? null,
        positionCount: latest?.positionCount ?? null,
        topHoldingName,
      };
    });

    res.json({ rows });
  } catch (err) {
    console.error('Error fetching funds:', err);
    res.status(500).json({ error: 'Failed to fetch funds' });
  }
});

// GET /api/funds/summary — home card counts
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const fundRows = db.select().from(funds).all();
    const today = new Date().toISOString().slice(0, 10);

    let totalPositions = 0;
    let refreshedTodayCount = 0;

    for (const f of fundRows) {
      if (f.lastSyncedAt && f.lastSyncedAt.slice(0, 10) === today) refreshedTodayCount++;
      const latest = latestFilingForFund(f.id);
      if (latest) totalPositions += latest.positionCount;
    }

    const summary: FundsHomeSummary = {
      trackedCount: fundRows.length,
      totalPositions,
      refreshedTodayCount,
    };
    res.json(summary);
  } catch (err) {
    console.error('Error fetching funds summary:', err);
    res.status(500).json({ error: 'Failed to fetch funds summary' });
  }
});

// POST /api/funds — add a fund by CIK
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateFundRequest;
    if (!body.cik?.trim()) {
      res.status(400).json({ error: 'cik is required' });
      return;
    }

    const cik = padCik(body.cik);
    const existing = db.select().from(funds).where(eq(funds.cik, cik)).get();
    if (existing) {
      res.status(409).json({ error: 'Fund already tracked' });
      return;
    }

    const now = new Date().toISOString();
    const fund: typeof funds.$inferInsert = {
      id: uuidv4(),
      cik,
      name: body.name?.trim() || `CIK ${cik}`,
      status: 'active',
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    db.insert(funds).values(fund).run();

    res.status(201).json(rowToFund(fund as typeof funds.$inferSelect));
  } catch (err) {
    console.error('Error adding fund:', err);
    res.status(500).json({ error: 'Failed to add fund' });
  }
});

// GET /api/funds/:id — fund + filings + latest holdings
router.get('/:id', (req: Request, res: Response) => {
  try {
    const fund = db.select().from(funds).where(eq(funds.id, paramId(req))).get();
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    const filingRows = db
      .select()
      .from(fundFilings)
      .where(eq(fundFilings.fundId, fund.id))
      .orderBy(desc(fundFilings.periodOfReport))
      .all();

    const latest = filingRows[0];
    const holdings = latest
      ? db
          .select()
          .from(fundHoldings)
          .where(eq(fundHoldings.filingId, latest.id))
          .orderBy(desc(fundHoldings.valueCents))
          .all()
      : [];

    const response: FundDetailResponse = {
      fund: rowToFund(fund),
      filings: filingRows.map(rowToFiling),
      latestFiling: latest ? rowToFiling(latest) : null,
      holdings: holdings.map(rowToHolding),
    };
    res.json(response);
  } catch (err) {
    console.error('Error fetching fund:', err);
    res.status(500).json({ error: 'Failed to fetch fund' });
  }
});

// GET /api/funds/:id/holdings?filingId= — holdings for a filing
router.get('/:id/holdings', (req: Request, res: Response) => {
  try {
    const fund = db.select().from(funds).where(eq(funds.id, paramId(req))).get();
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    const filingId = (req.query.filingId as string | undefined)?.trim();
    let filing = filingId
      ? db
          .select()
          .from(fundFilings)
          .where(and(eq(fundFilings.id, filingId), eq(fundFilings.fundId, fund.id)))
          .get()
      : latestFilingForFund(fund.id);

    if (!filing) {
      res.json([]);
      return;
    }

    const holdings = db
      .select()
      .from(fundHoldings)
      .where(eq(fundHoldings.filingId, filing.id))
      .orderBy(desc(fundHoldings.valueCents))
      .all();

    res.json(holdings.map(rowToHolding));
  } catch (err) {
    console.error('Error fetching holdings:', err);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// POST /api/funds/:id/refresh — backfill recent 13F-HR filings from SEC
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const fund = db.select().from(funds).where(eq(funds.id, paramId(req))).get();
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    const recent = await getRecent13Fs(fund.cik, BACKFILL_LIMIT);
    const now = new Date().toISOString();

    if (recent.length === 0) {
      db.update(funds).set({ lastSyncedAt: now, updatedAt: now }).where(eq(funds.id, fund.id)).run();
      const response: RefreshFundResponse = {
        fund: { ...rowToFund(fund), lastSyncedAt: now, updatedAt: now },
        filing: null,
        holdingsCount: 0,
        message: 'No 13F-HR filing found for this fund.',
      };
      res.json(response);
      return;
    }

    const symbolToStockId = buildSymbolToStockId();
    let importedFilings = 0;
    let latestImportedHoldings = 0;
    let latestFilingRow: typeof fundFilings.$inferSelect | undefined;

    // Process oldest → newest so the most recent filing ends up "latest".
    const ordered = [...recent].sort((a, b) => a.periodOfReport.localeCompare(b.periodOfReport));

    for (const info of ordered) {
      const existing = db
        .select()
        .from(fundFilings)
        .where(eq(fundFilings.accessionNumber, info.accessionNumber))
        .get();
      if (existing) {
        latestFilingRow = existing;
        continue;
      }

      const parsed = await getInfoTableHoldings(fund.cik, info.accessionNumber, info.periodOfReport);
      if (parsed.length === 0) continue;

      const totalValueCents = parsed.reduce((sum, h) => sum + h.valueCents, 0);
      const filingId = uuidv4();
      const filing: typeof fundFilings.$inferInsert = {
        id: filingId,
        fundId: fund.id,
        accessionNumber: info.accessionNumber,
        periodOfReport: info.periodOfReport,
        quarter: quarterFromPeriod(info.periodOfReport),
        filedAt: info.filedAt,
        totalValueCents,
        positionCount: parsed.length,
        createdAt: now,
      };
      db.insert(fundFilings).values(filing).run();

      for (const h of parsed) {
        const { ticker, stockId } = await resolveLink(h.cusip, h.issuerName, symbolToStockId, now);
        db.insert(fundHoldings).values({
          id: uuidv4(),
          filingId,
          issuerName: h.issuerName,
          cusip: h.cusip,
          ticker,
          stockId,
          valueCents: h.valueCents,
          shares: h.shares,
          putCall: h.putCall,
          pctOfPortfolio: totalValueCents > 0 ? (h.valueCents / totalValueCents) * 100 : 0,
          createdAt: now,
        }).run();
      }

      importedFilings++;
      latestImportedHoldings = parsed.length;
      latestFilingRow = filing as typeof fundFilings.$inferSelect;
    }

    // Backfill ticker/stock links on any holdings still missing them — e.g. a
    // filing imported before cusip_map was populated by this backfill pass.
    const fundFilingIds = db
      .select({ id: fundFilings.id })
      .from(fundFilings)
      .where(eq(fundFilings.fundId, fund.id))
      .all()
      .map((r) => r.id);
    if (fundFilingIds.length > 0) {
      const unlinked = db
        .select()
        .from(fundHoldings)
        .where(and(inArray(fundHoldings.filingId, fundFilingIds), isNull(fundHoldings.ticker)))
        .all();
      for (const h of unlinked) {
        const { ticker, stockId } = await resolveLink(h.cusip, h.issuerName, symbolToStockId, now);
        if (ticker || stockId) {
          db.update(fundHoldings).set({ ticker, stockId }).where(eq(fundHoldings.id, h.id)).run();
        }
      }
    }

    db.update(funds).set({ lastSyncedAt: now, updatedAt: now }).where(eq(funds.id, fund.id)).run();

    const latest = latestFilingForFund(fund.id) ?? latestFilingRow;
    const message =
      importedFilings === 0
        ? `Already up to date${latest ? ` (${latest.quarter})` : ''}.`
        : `Imported ${importedFilings} filing${importedFilings === 1 ? '' : 's'}${
            latestImportedHoldings ? ` (latest: ${latestImportedHoldings} positions)` : ''
          }.`;

    const response: RefreshFundResponse = {
      fund: { ...rowToFund(fund), lastSyncedAt: now, updatedAt: now },
      filing: latest ? rowToFiling(latest) : null,
      holdingsCount: latest
        ? db.select().from(fundHoldings).where(eq(fundHoldings.filingId, latest.id)).all().length
        : 0,
      message,
    };
    res.json(response);
  } catch (err) {
    console.error('Error refreshing fund:', err);
    res.status(500).json({ error: 'Failed to refresh fund from SEC EDGAR' });
  }
});

interface AggregatedPosition {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  shares: number;
  valueCents: number;
  pctOfPortfolio: number;
}

/** Aggregate holdings of one filing by CUSIP (manager filings may list a position twice). */
function aggregateFilingHoldings(filingId: string): Map<string, AggregatedPosition> {
  const rows = db.select().from(fundHoldings).where(eq(fundHoldings.filingId, filingId)).all();
  const map = new Map<string, AggregatedPosition>();
  for (const r of rows) {
    const key = r.cusip || r.issuerName;
    const existing = map.get(key);
    if (existing) {
      existing.shares += r.shares;
      existing.valueCents += r.valueCents;
      existing.pctOfPortfolio += r.pctOfPortfolio;
      if (!existing.ticker && r.ticker) {
        existing.ticker = r.ticker;
        existing.stockId = r.stockId;
      }
    } else {
      map.set(key, {
        cusip: r.cusip,
        issuerName: r.issuerName,
        ticker: r.ticker,
        stockId: r.stockId,
        shares: r.shares,
        valueCents: r.valueCents,
        pctOfPortfolio: r.pctOfPortfolio,
      });
    }
  }
  return map;
}

// GET /api/funds/:id/deltas?from=&to= — quarter-over-quarter position changes
router.get('/:id/deltas', (req: Request, res: Response) => {
  try {
    const fund = db.select().from(funds).where(eq(funds.id, paramId(req))).get();
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    const filingRows = db
      .select()
      .from(fundFilings)
      .where(eq(fundFilings.fundId, fund.id))
      .orderBy(desc(fundFilings.periodOfReport))
      .all();

    const toId = (req.query.to as string | undefined)?.trim() || filingRows[0]?.id;
    const fromId = (req.query.from as string | undefined)?.trim() || filingRows[1]?.id;

    const toFiling = filingRows.find((f) => f.id === toId) ?? null;
    const fromFiling = filingRows.find((f) => f.id === fromId) ?? null;

    const toMap = toFiling ? aggregateFilingHoldings(toFiling.id) : new Map<string, AggregatedPosition>();
    const fromMap = fromFiling ? aggregateFilingHoldings(fromFiling.id) : new Map<string, AggregatedPosition>();

    const keys = new Set<string>([...toMap.keys(), ...fromMap.keys()]);
    const deltas: HoldingDelta[] = [];

    for (const key of keys) {
      const to = toMap.get(key);
      const from = fromMap.get(key);
      const fromShares = from?.shares ?? 0;
      const toShares = to?.shares ?? 0;
      const sharesChange = toShares - fromShares;

      let changeType: HoldingChangeType;
      if (!from && to) changeType = 'new';
      else if (from && !to) changeType = 'exit';
      else if (sharesChange > 0) changeType = 'add';
      else if (sharesChange < 0) changeType = 'trim';
      else changeType = 'hold';

      const base = to ?? from!;
      deltas.push({
        cusip: base.cusip,
        issuerName: base.issuerName,
        ticker: base.ticker,
        stockId: base.stockId,
        changeType,
        fromShares,
        toShares,
        sharesChange,
        sharesChangePercent: fromShares > 0 ? (sharesChange / fromShares) * 100 : null,
        fromValueCents: from?.valueCents ?? 0,
        toValueCents: to?.valueCents ?? 0,
        valueChangeCents: (to?.valueCents ?? 0) - (from?.valueCents ?? 0),
        toPctOfPortfolio: to?.pctOfPortfolio ?? 0,
      });
    }

    deltas.sort((a, b) => b.toValueCents - a.toValueCents || b.fromValueCents - a.fromValueCents);

    const response: FundDeltasResponse = {
      fromFiling: fromFiling ? rowToFiling(fromFiling) : null,
      toFiling: toFiling ? rowToFiling(toFiling) : null,
      deltas,
    };
    res.json(response);
  } catch (err) {
    console.error('Error computing deltas:', err);
    res.status(500).json({ error: 'Failed to compute deltas' });
  }
});

// POST /api/funds/holdings/:holdingId/link — manually map a holding to a tracked stock
router.post('/holdings/:holdingId/link', (req: Request, res: Response) => {
  try {
    const holdingId = req.params.holdingId as string;
    const holding = db.select().from(fundHoldings).where(eq(fundHoldings.id, holdingId)).get();
    if (!holding) {
      res.status(404).json({ error: 'Holding not found' });
      return;
    }

    const body = req.body as LinkHoldingRequest;
    const now = new Date().toISOString();

    let ticker: string | null = null;
    let stockId: string | null = null;

    if (body.stockId) {
      const stock = db.select().from(stocks).where(eq(stocks.id, body.stockId)).get();
      if (!stock) {
        res.status(400).json({ error: 'stock not found' });
        return;
      }
      stockId = stock.id;
      ticker = (body.ticker?.trim() || stock.symbol).toUpperCase();
    } else if (body.ticker?.trim()) {
      ticker = body.ticker.trim().toUpperCase();
      const stock = db.select().from(stocks).where(eq(stocks.symbol, ticker)).get();
      stockId = stock?.id ?? null;
    } else {
      res.status(400).json({ error: 'stockId or ticker is required' });
      return;
    }

    // Persist the mapping for every holding sharing this CUSIP (current + future links).
    if (holding.cusip && ticker) {
      db.insert(cusipMap)
        .values({ cusip: holding.cusip, ticker, source: 'manual', updatedAt: now })
        .onConflictDoUpdate({
          target: cusipMap.cusip,
          set: { ticker, source: 'manual', updatedAt: now },
        })
        .run();

      db.update(fundHoldings)
        .set({ ticker, stockId })
        .where(eq(fundHoldings.cusip, holding.cusip))
        .run();
    } else {
      db.update(fundHoldings).set({ ticker, stockId }).where(eq(fundHoldings.id, holding.id)).run();
    }

    const updated = db.select().from(fundHoldings).where(eq(fundHoldings.id, holding.id)).get()!;
    res.json(rowToHolding(updated));
  } catch (err) {
    console.error('Error linking holding:', err);
    res.status(500).json({ error: 'Failed to link holding' });
  }
});

// DELETE /api/funds/:id — untrack a fund (cascades filings + holdings)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const fund = db.select().from(funds).where(eq(funds.id, paramId(req))).get();
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }
    db.delete(funds).where(eq(funds.id, fund.id)).run();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting fund:', err);
    res.status(500).json({ error: 'Failed to delete fund' });
  }
});

export default router;
