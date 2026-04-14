import { Router, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateStockRequest,
  RefreshStockResponse,
  Stock,
  StockDashboardRow,
  StockDetail,
  StockLookupResponse,
  StockMetricsCache,
  StockMetricsSnapshot,
  StocksDashboardResponse,
  StocksHomeSummary,
  StockVersion,
  StockVersionPayload,
  StockVersionSource,
  UpdateStockRequest,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { stockMetricsCache, stocks, stockVersions } from '../../../db/schema.js';
import { fetchAlphaVantageMetrics } from '../lib/alphaVantage.js';

const router = Router();

function paramId(req: Request): string {
  return req.params.id as string;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function createVersionPayload(stock: Stock): StockVersionPayload {
  return {
    symbol: stock.symbol,
    companyName: stock.companyName,
    exchange: stock.exchange,
    sector: stock.sector,
    industry: stock.industry,
    trackingMode: stock.trackingMode,
    status: stock.status,
    thesis: stock.thesis,
    notesHtml: stock.notesHtml,
    sharesMilli: stock.sharesMilli,
    averageCostBasis: stock.averageCostBasis,
    conviction: stock.conviction,
    manualTargetPrice: stock.manualTargetPrice,
    manualCurrentPrice: stock.manualCurrentPrice,
    manualPeRatio: stock.manualPeRatio,
    manualPbRatio: stock.manualPbRatio,
    manualPsRatio: stock.manualPsRatio,
    manualEpsGrowth: stock.manualEpsGrowth,
  };
}

function parseVersionRow(row: { id: string; stockId: string; source: StockVersionSource; payload: string; createdAt: string }): StockVersion {
  return {
    id: row.id,
    stockId: row.stockId,
    source: row.source,
    createdAt: row.createdAt,
    payload: JSON.parse(row.payload) as StockVersionPayload,
  };
}

function upsertMetricsSnapshot(stock: Stock, metrics: StockMetricsCache | null): StockMetricsSnapshot {
  return {
    openPrice: metrics?.openPrice ?? null,
    highPrice: metrics?.highPrice ?? null,
    lowPrice: metrics?.lowPrice ?? null,
    currentPrice: stock.manualCurrentPrice ?? metrics?.currentPrice ?? null,
    previousClosePrice: metrics?.previousClosePrice ?? null,
    priceChange: metrics?.priceChange ?? null,
    priceChangePercent: metrics?.priceChangePercent ?? null,
    analystTargetPrice: stock.manualTargetPrice ?? metrics?.analystTargetPrice ?? null,
    volume: metrics?.volume ?? null,
    latestTradingDay: metrics?.latestTradingDay ?? null,
    peRatio: stock.manualPeRatio ?? metrics?.peRatio ?? null,
    pbRatio: stock.manualPbRatio ?? metrics?.pbRatio ?? null,
    psRatio: stock.manualPsRatio ?? metrics?.psRatio ?? null,
    epsGrowth: stock.manualEpsGrowth ?? metrics?.epsGrowth ?? null,
    marketCap: metrics?.marketCap ?? null,
    beta: metrics?.beta ?? null,
    fiftyTwoWeekHigh: metrics?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: metrics?.fiftyTwoWeekLow ?? null,
    fiftyDayMovingAverage: metrics?.fiftyDayMovingAverage ?? null,
    twoHundredDayMovingAverage: metrics?.twoHundredDayMovingAverage ?? null,
    dividendYield: metrics?.dividendYield ?? null,
    profitMargin: metrics?.profitMargin ?? null,
    operatingMarginTtm: metrics?.operatingMarginTtm ?? null,
    returnOnAssetsTtm: metrics?.returnOnAssetsTtm ?? null,
    returnOnEquityTtm: metrics?.returnOnEquityTtm ?? null,
    quarterlyEarningsGrowthYoy: metrics?.quarterlyEarningsGrowthYoy ?? null,
    quarterlyRevenueGrowthYoy: metrics?.quarterlyRevenueGrowthYoy ?? null,
    sharesOutstanding: metrics?.sharesOutstanding ?? null,
    revenueTtm: metrics?.revenueTtm ?? null,
    grossProfitTtm: metrics?.grossProfitTtm ?? null,
  };
}

function computeUpsidePercent(snapshot: StockMetricsSnapshot): number | null {
  if (!snapshot.currentPrice || !snapshot.analystTargetPrice) {
    return null;
  }

  return Number((((snapshot.analystTargetPrice - snapshot.currentPrice) / snapshot.currentPrice) * 100).toFixed(2));
}

function computePositionValue(stock: Stock, snapshot: StockMetricsSnapshot): number | null {
  if (!stock.sharesMilli || !snapshot.currentPrice) {
    return null;
  }

  return Math.round((stock.sharesMilli / 1000) * snapshot.currentPrice);
}

function toDashboardRow(stock: Stock, metrics: StockMetricsCache | null): StockDashboardRow {
  const effectiveMetrics = upsertMetricsSnapshot(stock, metrics);

  return {
    stock,
    metrics: effectiveMetrics,
    refreshState: metrics?.refreshState ?? 'never',
    analystRating: metrics?.analystRating ?? null,
    upsidePercent: computeUpsidePercent(effectiveMetrics),
    positionValue: computePositionValue(stock, effectiveMetrics),
    lastFetchedAt: metrics?.fetchedAt ?? null,
  };
}

function writeVersion(stock: Stock, source: StockVersionSource): void {
  db.insert(stockVersions).values({
    id: uuidv4(),
    stockId: stock.id,
    source,
    payload: JSON.stringify(createVersionPayload(stock)),
    createdAt: new Date().toISOString(),
  }).run();
}

function toMetricsCache(row: typeof stockMetricsCache.$inferSelect): StockMetricsCache {
  return {
    ...row,
    source: 'alpha-vantage',
  };
}

function buildMetricsCache(stockId: string, existingCache: StockMetricsCache | null, now: string, refreshState: StockMetricsCache['refreshState'], errorMessage: string | null, metrics?: Awaited<ReturnType<typeof fetchAlphaVantageMetrics>>): StockMetricsCache {
  return {
    id: existingCache?.id ?? uuidv4(),
    stockId,
    source: 'alpha-vantage',
    refreshState,
    openPrice: metrics?.openPrice ?? existingCache?.openPrice ?? null,
    highPrice: metrics?.highPrice ?? existingCache?.highPrice ?? null,
    lowPrice: metrics?.lowPrice ?? existingCache?.lowPrice ?? null,
    currentPrice: metrics?.currentPrice ?? existingCache?.currentPrice ?? null,
    previousClosePrice: metrics?.previousClosePrice ?? existingCache?.previousClosePrice ?? null,
    priceChange: metrics?.priceChange ?? existingCache?.priceChange ?? null,
    priceChangePercent: metrics?.priceChangePercent ?? existingCache?.priceChangePercent ?? null,
    analystTargetPrice: metrics?.analystTargetPrice ?? existingCache?.analystTargetPrice ?? null,
    volume: metrics?.volume ?? existingCache?.volume ?? null,
    latestTradingDay: metrics?.latestTradingDay ?? existingCache?.latestTradingDay ?? null,
    peRatio: metrics?.peRatio ?? existingCache?.peRatio ?? null,
    pbRatio: metrics?.pbRatio ?? existingCache?.pbRatio ?? null,
    psRatio: metrics?.psRatio ?? existingCache?.psRatio ?? null,
    epsGrowth: metrics?.epsGrowth ?? existingCache?.epsGrowth ?? null,
    marketCap: metrics?.marketCap ?? existingCache?.marketCap ?? null,
    beta: metrics?.beta ?? existingCache?.beta ?? null,
    fiftyTwoWeekHigh: metrics?.fiftyTwoWeekHigh ?? existingCache?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: metrics?.fiftyTwoWeekLow ?? existingCache?.fiftyTwoWeekLow ?? null,
    fiftyDayMovingAverage: metrics?.fiftyDayMovingAverage ?? existingCache?.fiftyDayMovingAverage ?? null,
    twoHundredDayMovingAverage: metrics?.twoHundredDayMovingAverage ?? existingCache?.twoHundredDayMovingAverage ?? null,
    dividendYield: metrics?.dividendYield ?? existingCache?.dividendYield ?? null,
    profitMargin: metrics?.profitMargin ?? existingCache?.profitMargin ?? null,
    operatingMarginTtm: metrics?.operatingMarginTtm ?? existingCache?.operatingMarginTtm ?? null,
    returnOnAssetsTtm: metrics?.returnOnAssetsTtm ?? existingCache?.returnOnAssetsTtm ?? null,
    returnOnEquityTtm: metrics?.returnOnEquityTtm ?? existingCache?.returnOnEquityTtm ?? null,
    quarterlyEarningsGrowthYoy: metrics?.quarterlyEarningsGrowthYoy ?? existingCache?.quarterlyEarningsGrowthYoy ?? null,
    quarterlyRevenueGrowthYoy: metrics?.quarterlyRevenueGrowthYoy ?? existingCache?.quarterlyRevenueGrowthYoy ?? null,
    sharesOutstanding: metrics?.sharesOutstanding ?? existingCache?.sharesOutstanding ?? null,
    revenueTtm: metrics?.revenueTtm ?? existingCache?.revenueTtm ?? null,
    grossProfitTtm: metrics?.grossProfitTtm ?? existingCache?.grossProfitTtm ?? null,
    analystRating: metrics?.analystRating ?? existingCache?.analystRating ?? null,
    fetchedAt: metrics ? now : existingCache?.fetchedAt ?? null,
    errorMessage,
    createdAt: existingCache?.createdAt ?? now,
    updatedAt: now,
  };
}

function getAllStocks(): Stock[] {
  return db.select().from(stocks).orderBy(desc(stocks.updatedAt)).all();
}

function getMetricsMap(): Map<string, StockMetricsCache> {
  const rows = db.select().from(stockMetricsCache).all();
  return new Map(rows.map((row) => [row.stockId, toMetricsCache(row)]));
}

function buildDashboardResponse(): StocksDashboardResponse {
  const allStocks = getAllStocks().filter((stock) => stock.status === 'active');
  const metricsByStockId = getMetricsMap();
  const rows = allStocks.map((stock) => toDashboardRow(stock, metricsByStockId.get(stock.id) ?? null));
  const upsideValues = rows.map((row) => row.upsidePercent).filter((value): value is number => value !== null);

  return {
    summary: {
      totalTracked: rows.length,
      holdingsCount: rows.filter((row) => row.stock.trackingMode === 'holding' || row.stock.trackingMode === 'both').length,
      watchlistCount: rows.filter((row) => row.stock.trackingMode === 'watchlist' || row.stock.trackingMode === 'both').length,
      averageUpsidePercent: upsideValues.length > 0 ? Number((upsideValues.reduce((sum, value) => sum + value, 0) / upsideValues.length).toFixed(2)) : null,
      totalPositionValue: rows.reduce((sum, row) => sum + (row.positionValue ?? 0), 0),
      staleCount: rows.filter((row) => row.refreshState === 'stale' || row.refreshState === 'error' || row.refreshState === 'never').length,
    },
    rows,
  };
}

function buildHomeSummary(dashboard: StocksDashboardResponse): StocksHomeSummary {
  return {
    trackedCount: dashboard.summary.totalTracked,
    holdingsCount: dashboard.summary.holdingsCount,
    averageUpsidePercent: dashboard.summary.averageUpsidePercent,
    refreshedTodayCount: dashboard.rows.filter((row) => {
      if (!row.lastFetchedAt) {
        return false;
      }

      return row.lastFetchedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
    }).length,
  };
}

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(buildDashboardResponse());
  } catch (err) {
    console.error('Error fetching stocks dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch stocks dashboard' });
  }
});

router.get('/summary', (_req: Request, res: Response) => {
  try {
    const dashboard = buildDashboardResponse();
    res.json(buildHomeSummary(dashboard));
  } catch (err) {
    console.error('Error fetching stocks summary:', err);
    res.status(500).json({ error: 'Failed to fetch stocks summary' });
  }
});

router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const symbol = typeof req.body?.symbol === 'string' ? normalizeSymbol(req.body.symbol) : '';

    if (!symbol) {
      res.status(400).json({ error: 'symbol is required' });
      return;
    }

    const metrics = await fetchAlphaVantageMetrics(symbol);
    const response: StockLookupResponse = {
      symbol,
      companyName: metrics.companyName,
      exchange: metrics.exchange,
      sector: metrics.sector,
      industry: metrics.industry,
      analystRating: metrics.analystRating,
      metrics: {
        openPrice: metrics.openPrice,
        highPrice: metrics.highPrice,
        lowPrice: metrics.lowPrice,
        currentPrice: metrics.currentPrice,
        previousClosePrice: metrics.previousClosePrice,
        priceChange: metrics.priceChange,
        priceChangePercent: metrics.priceChangePercent,
        analystTargetPrice: metrics.analystTargetPrice,
        volume: metrics.volume,
        latestTradingDay: metrics.latestTradingDay,
        peRatio: metrics.peRatio,
        pbRatio: metrics.pbRatio,
        psRatio: metrics.psRatio,
        epsGrowth: metrics.epsGrowth,
        marketCap: metrics.marketCap,
        beta: metrics.beta,
        fiftyTwoWeekHigh: metrics.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: metrics.fiftyTwoWeekLow,
        fiftyDayMovingAverage: metrics.fiftyDayMovingAverage,
        twoHundredDayMovingAverage: metrics.twoHundredDayMovingAverage,
        dividendYield: metrics.dividendYield,
        profitMargin: metrics.profitMargin,
        operatingMarginTtm: metrics.operatingMarginTtm,
        returnOnAssetsTtm: metrics.returnOnAssetsTtm,
        returnOnEquityTtm: metrics.returnOnEquityTtm,
        quarterlyEarningsGrowthYoy: metrics.quarterlyEarningsGrowthYoy,
        quarterlyRevenueGrowthYoy: metrics.quarterlyRevenueGrowthYoy,
        sharesOutstanding: metrics.sharesOutstanding,
        revenueTtm: metrics.revenueTtm,
        grossProfitTtm: metrics.grossProfitTtm,
      },
    };

    res.json(response);
  } catch (err) {
    console.error('Error looking up stock symbol:', err);
    const message = err instanceof Error ? err.message : 'Failed to look up stock symbol';
    res.status(502).json({ error: message });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const stock = db.select().from(stocks).where(eq(stocks.id, paramId(req))).get();

    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    const history = db.select().from(stockVersions).where(eq(stockVersions.stockId, stock.id)).orderBy(desc(stockVersions.createdAt)).all().map(parseVersionRow);
    res.json(history);
  } catch (err) {
    console.error('Error fetching stock history:', err);
    res.status(500).json({ error: 'Failed to fetch stock history' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const stock = db.select().from(stocks).where(eq(stocks.id, paramId(req))).get();

    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    const metricsRow = db.select().from(stockMetricsCache).where(eq(stockMetricsCache.stockId, stock.id)).get() ?? null;
    const metrics = metricsRow ? toMetricsCache(metricsRow) : null;
    const history = db.select().from(stockVersions).where(eq(stockVersions.stockId, stock.id)).orderBy(desc(stockVersions.createdAt)).all().map(parseVersionRow);
    const effectiveMetrics = upsertMetricsSnapshot(stock, metrics);

    const detail: StockDetail = {
      ...stock,
      metricsCache: metrics,
      history,
      effectiveMetrics,
      upsidePercent: computeUpsidePercent(effectiveMetrics),
      positionValue: computePositionValue(stock, effectiveMetrics),
    };

    res.json(detail);
  } catch (err) {
    console.error('Error fetching stock detail:', err);
    res.status(500).json({ error: 'Failed to fetch stock detail' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const body: CreateStockRequest = req.body;

    if (!body.symbol || !body.companyName || !body.trackingMode) {
      res.status(400).json({ error: 'symbol, companyName, and trackingMode are required' });
      return;
    }

    const now = new Date().toISOString();
    const stock: Stock = {
      id: uuidv4(),
      symbol: normalizeSymbol(body.symbol),
      companyName: body.companyName.trim(),
      exchange: body.exchange ?? null,
      sector: body.sector ?? null,
      industry: body.industry ?? null,
      trackingMode: body.trackingMode,
      status: body.status ?? 'active',
      thesis: body.thesis ?? null,
      notesHtml: body.notesHtml ?? null,
      sharesMilli: body.sharesMilli ?? null,
      averageCostBasis: body.averageCostBasis ?? null,
      conviction: body.conviction ?? null,
      manualTargetPrice: body.manualTargetPrice ?? null,
      manualCurrentPrice: body.manualCurrentPrice ?? null,
      manualPeRatio: body.manualPeRatio ?? null,
      manualPbRatio: body.manualPbRatio ?? null,
      manualPsRatio: body.manualPsRatio ?? null,
      manualEpsGrowth: body.manualEpsGrowth ?? null,
      lastManualUpdateAt: now,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(stocks).values(stock).run();
    writeVersion(stock, 'manual');

    // If initial metrics from a lookup are provided, seed the metrics cache
    if (body.initialMetrics) {
      const cacheRecord: typeof stockMetricsCache.$inferInsert = {
        id: uuidv4(),
        stockId: stock.id,
        source: 'alpha-vantage',
        refreshState: 'fresh',
        ...body.initialMetrics,
        analystRating: body.initialAnalystRating ?? null,
        fetchedAt: now,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(stockMetricsCache).values(cacheRecord).run();
    }

    res.status(201).json(stock);
  } catch (err) {
    console.error('Error creating stock:', err);
    res.status(500).json({ error: 'Failed to create stock' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(stocks).where(eq(stocks.id, paramId(req))).get();

    if (!existing) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    const body: UpdateStockRequest = req.body;
    const source = body.refreshSource ?? 'manual';
    const now = new Date().toISOString();

    const updated: Stock = {
      ...existing,
      symbol: body.symbol ? normalizeSymbol(body.symbol) : existing.symbol,
      companyName: body.companyName?.trim() || existing.companyName,
      exchange: body.exchange !== undefined ? body.exchange : existing.exchange,
      sector: body.sector !== undefined ? body.sector : existing.sector,
      industry: body.industry !== undefined ? body.industry : existing.industry,
      trackingMode: body.trackingMode ?? existing.trackingMode,
      status: body.status ?? existing.status,
      thesis: body.thesis !== undefined ? body.thesis : existing.thesis,
      notesHtml: body.notesHtml !== undefined ? body.notesHtml : existing.notesHtml,
      sharesMilli: body.sharesMilli !== undefined ? body.sharesMilli : existing.sharesMilli,
      averageCostBasis: body.averageCostBasis !== undefined ? body.averageCostBasis : existing.averageCostBasis,
      conviction: body.conviction !== undefined ? body.conviction : existing.conviction,
      manualTargetPrice: body.manualTargetPrice !== undefined ? body.manualTargetPrice : existing.manualTargetPrice,
      manualCurrentPrice: body.manualCurrentPrice !== undefined ? body.manualCurrentPrice : existing.manualCurrentPrice,
      manualPeRatio: body.manualPeRatio !== undefined ? body.manualPeRatio : existing.manualPeRatio,
      manualPbRatio: body.manualPbRatio !== undefined ? body.manualPbRatio : existing.manualPbRatio,
      manualPsRatio: body.manualPsRatio !== undefined ? body.manualPsRatio : existing.manualPsRatio,
      manualEpsGrowth: body.manualEpsGrowth !== undefined ? body.manualEpsGrowth : existing.manualEpsGrowth,
      lastManualUpdateAt: source === 'manual' ? now : existing.lastManualUpdateAt,
      lastSyncedAt: source === 'api-refresh' ? now : existing.lastSyncedAt,
      updatedAt: now,
    };

    db.update(stocks).set(updated).where(eq(stocks.id, existing.id)).run();
    writeVersion(updated, source);

    res.json(updated);
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(stocks).where(eq(stocks.id, paramId(req))).get();

    if (!existing) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    db.delete(stocks).where(eq(stocks.id, existing.id)).run();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting stock:', err);
    res.status(500).json({ error: 'Failed to delete stock' });
  }
});

router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const stock = db.select().from(stocks).where(eq(stocks.id, paramId(req))).get();

    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    const now = new Date().toISOString();

    try {
      const metrics = await fetchAlphaVantageMetrics(stock.symbol);
      const existingCache = (db.select().from(stockMetricsCache).where(eq(stockMetricsCache.stockId, stock.id)).get() ?? null);
      const cacheRecord = buildMetricsCache(stock.id, existingCache ? toMetricsCache(existingCache) : null, now, 'fresh', null, metrics);

      if (existingCache) {
        db.update(stockMetricsCache).set(cacheRecord).where(eq(stockMetricsCache.stockId, stock.id)).run();
      } else {
        db.insert(stockMetricsCache).values(cacheRecord).run();
      }

      const enrichedUpdate: Partial<Stock> = {
        companyName: stock.companyName || metrics.companyName || stock.companyName,
        exchange: stock.exchange ?? metrics.exchange,
        sector: stock.sector ?? metrics.sector,
        industry: stock.industry ?? metrics.industry,
        lastSyncedAt: now,
        updatedAt: now,
      };

      const didChange = enrichedUpdate.exchange !== stock.exchange
        || enrichedUpdate.sector !== stock.sector
        || enrichedUpdate.industry !== stock.industry
        || enrichedUpdate.companyName !== stock.companyName;

      if (didChange) {
        const updatedStock: Stock = { ...stock, ...enrichedUpdate };
        db.update(stocks).set(updatedStock).where(eq(stocks.id, stock.id)).run();
        writeVersion(updatedStock, 'api-refresh');
      } else {
        db.update(stocks).set({ lastSyncedAt: now, updatedAt: now }).where(eq(stocks.id, stock.id)).run();
      }

      const response: RefreshStockResponse = {
        stockId: stock.id,
        refreshState: 'fresh',
        metricsCache: cacheRecord,
        message: `Refreshed ${stock.symbol} from Alpha Vantage`,
      };

      res.json(response);
    } catch (refreshErr) {
      const message = refreshErr instanceof Error ? refreshErr.message : 'Unknown refresh error';
      const existingCache = (db.select().from(stockMetricsCache).where(eq(stockMetricsCache.stockId, stock.id)).get() ?? null);
      const failedCache = buildMetricsCache(stock.id, existingCache ? toMetricsCache(existingCache) : null, now, 'error', message);

      if (existingCache) {
        db.update(stockMetricsCache).set(failedCache).where(eq(stockMetricsCache.stockId, stock.id)).run();
      } else {
        db.insert(stockMetricsCache).values(failedCache).run();
      }

      res.status(502).json({ error: message });
    }
  } catch (err) {
    console.error('Error refreshing stock:', err);
    res.status(500).json({ error: 'Failed to refresh stock' });
  }
});

export default router;