import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { plaidConnections, stocks, stockLots, stockTransactions } from '../../../db/schema.js';
import {
  createLinkToken,
  exchangePublicToken,
  getInstitutionName,
  getAccounts,
  getInvestmentHoldings,
  getInvestmentTransactions,
  encryptToken,
  decryptToken,
} from '../lib/plaidClient.js';
import type { PlaidSyncResult, PlaidHoldingPreview } from '@networth/shared';

const router = Router();

// ── POST /link-token ──
router.post('/link-token', async (_req: Request, res: Response) => {
  try {
    const linkToken = await createLinkToken();
    res.json({ linkToken });
  } catch (err) {
    console.error('[Plaid] link-token error:', err);
    res.status(500).json({ error: 'Failed to create Plaid link token' });
  }
});

// ── POST /exchange ──
router.post('/exchange', async (req: Request, res: Response) => {
  try {
    const { publicToken, institutionId } = req.body;
    if (!publicToken) {
      res.status(400).json({ error: 'publicToken is required' });
      return;
    }

    const { accessToken, itemId } = await exchangePublicToken(publicToken);
    const institutionName = institutionId ? await getInstitutionName(institutionId) : 'Unknown';

    // Fetch accounts for display
    const accounts = await getAccounts(accessToken);
    const accountsSummary = accounts.map((a) => ({
      id: a.account_id,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }));

    const now = new Date().toISOString();
    const connection = {
      id: uuidv4(),
      institutionName,
      institutionId: institutionId || 'unknown',
      accessToken: encryptToken(accessToken),
      itemId,
      accountsJson: JSON.stringify(accountsSummary),
      lastSyncedAt: null,
      createdAt: now,
    };

    db.insert(plaidConnections).values(connection).run();

    res.status(201).json({
      id: connection.id,
      institutionName: connection.institutionName,
      institutionId: connection.institutionId,
      accounts: accountsSummary,
      createdAt: connection.createdAt,
    });
  } catch (err) {
    console.error('[Plaid] exchange error:', err);
    res.status(500).json({ error: 'Failed to exchange Plaid token' });
  }
});

// ── POST /preview/:connectionId ──
// Returns all Plaid holdings matched against tracked stocks, without writing anything
router.post('/preview/:connectionId', async (req: Request, res: Response) => {
  try {
    const connection = db.select().from(plaidConnections).where(eq(plaidConnections.id, req.params.connectionId as string)).get();
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const accessToken = decryptToken(connection.accessToken);
    const trackedStocks = db.select().from(stocks).where(eq(stocks.status, 'active')).all();
    const symbolSet = new Set(trackedStocks.map((s) => s.symbol.toUpperCase()));

    const { holdings, securities } = await getInvestmentHoldings(accessToken);
    const securityMap = new Map(securities.map((s) => [s.security_id, s]));

    const previews: PlaidHoldingPreview[] = [];

    for (const holding of holdings) {
      const security = securityMap.get(holding.security_id);
      if (!security || !security.ticker_symbol) continue;

      const symbol = security.ticker_symbol.toUpperCase();
      const costBasisCents = holding.cost_basis ? Math.round(holding.cost_basis * 100) : null;
      const currentPriceCents = holding.institution_price ? Math.round(holding.institution_price * 100) : null;
      const currentValueCents = holding.institution_value ? Math.round(holding.institution_value * 100) : null;

      previews.push({
        symbol,
        name: security.name || symbol,
        shares: holding.quantity,
        costBasisCents,
        currentPriceCents,
        currentValueCents,
        isTracked: symbolSet.has(symbol),
        accountId: holding.account_id,
      });
    }

    // Sort: tracked first, then alphabetical
    previews.sort((a, b) => {
      if (a.isTracked !== b.isTracked) return a.isTracked ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    });

    res.json(previews);
  } catch (err) {
    console.error('[Plaid] preview error:', err);
    res.status(500).json({ error: 'Failed to preview Plaid holdings' });
  }
});

// ── POST /sync/:connectionId ──
// Accepts { symbols: string[] } — only syncs the selected symbols
router.post('/sync/:connectionId', async (req: Request, res: Response) => {
  try {
    const connection = db.select().from(plaidConnections).where(eq(plaidConnections.id, req.params.connectionId as string)).get();
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const { symbols: selectedSymbols } = req.body as { symbols?: string[] };
    if (!selectedSymbols || selectedSymbols.length === 0) {
      res.status(400).json({ error: 'symbols array is required' });
      return;
    }

    const selectedSet = new Set(selectedSymbols.map((s: string) => s.toUpperCase()));

    const accessToken = decryptToken(connection.accessToken);

    // Get all tracked stock symbols (active only)
    const trackedStocks = db.select().from(stocks)
      .where(eq(stocks.status, 'active'))
      .all();
    const symbolMap = new Map(trackedStocks.map((s) => [s.symbol.toUpperCase(), s]));

    // Fetch holdings from Plaid
    const { holdings, securities } = await getInvestmentHoldings(accessToken);
    const securityMap = new Map(securities.map((s) => [s.security_id, s]));

    const result: PlaidSyncResult = { synced: [], skipped: [], errors: [] };
    const now = new Date().toISOString();

    for (const holding of holdings) {
      const security = securityMap.get(holding.security_id);
      if (!security || !security.ticker_symbol) continue;

      const symbol = security.ticker_symbol.toUpperCase();

      // Skip if not in user's selection
      if (!selectedSet.has(symbol)) continue;

      const tracked = symbolMap.get(symbol);
      if (!tracked) {
        result.skipped.push(symbol);
        continue;
      }

      try {
        // Update stock with Plaid data
        const sharesMilli = Math.round(holding.quantity * 1000);
        const costBasisCents = holding.cost_basis ? Math.round(holding.cost_basis * 100) : null;
        const avgCostBasisCents = costBasisCents && holding.quantity > 0
          ? Math.round(costBasisCents / holding.quantity)
          : tracked.averageCostBasis;

        db.update(stocks).set({
          sharesMilli,
          averageCostBasis: avgCostBasisCents,
          plaidAccountId: holding.account_id,
          syncSource: 'plaid',
          lastPlaidSyncAt: now,
          updatedAt: now,
        }).where(eq(stocks.id, tracked.id)).run();

        result.synced.push({
          symbol,
          shares: holding.quantity,
          avgCostBasisCents: avgCostBasisCents ?? 0,
        });
      } catch (err) {
        result.errors.push(`${symbol}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Fetch investment transactions (last 2 years)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0];

    try {
      const { investmentTransactions, securities: txnSecurities } = await getInvestmentTransactions(accessToken, startDate, endDate);
      const txnSecMap = new Map(txnSecurities.map((s) => [s.security_id, s]));

      for (const txn of investmentTransactions) {
        const secId = txn.security_id;
        if (!secId) continue;
        const security = txnSecMap.get(secId);
        if (!security || !security.ticker_symbol) continue;

        const symbol = security.ticker_symbol.toUpperCase();
        if (!selectedSet.has(symbol)) continue;
        const tracked = symbolMap.get(symbol);
        if (!tracked) continue;

        // Check if already imported (dedup by plaid_transaction_id)
        const existing = db.select()
          .from(stockTransactions)
          .where(eq(stockTransactions.plaidTransactionId, txn.investment_transaction_id))
          .get();
        if (existing) continue;

        // Map Plaid transaction type to our type
        let type: 'buy' | 'sell' | 'dividend' | 'transfer' | 'fee' = 'buy';
        const plaidType = txn.type?.toLowerCase() || '';
        const plaidSubtype = txn.subtype?.toLowerCase() || '';
        if (plaidType === 'buy' || plaidSubtype === 'buy') type = 'buy';
        else if (plaidType === 'sell' || plaidSubtype === 'sell') type = 'sell';
        else if (plaidSubtype === 'dividend' || plaidSubtype === 'interest') type = 'dividend';
        else if (plaidType === 'fee') type = 'fee';
        else type = 'transfer';

        const quantity = Math.abs(txn.quantity ?? 0);
        const priceCents = Math.round(Math.abs(txn.price ?? 0) * 100);
        const amountCents = Math.round(Math.abs(txn.amount ?? 0) * 100);
        const feesCents = Math.round(Math.abs(txn.fees ?? 0) * 100);

        // Insert transaction log
        db.insert(stockTransactions).values({
          id: uuidv4(),
          stockId: tracked.id,
          connectionId: connection.id,
          plaidTransactionId: txn.investment_transaction_id,
          type,
          date: txn.date,
          quantity,
          priceCents,
          amountCents,
          feesCents,
          createdAt: now,
        }).run();

        // For buy transactions, create a lot
        if (type === 'buy' && quantity > 0) {
          db.insert(stockLots).values({
            id: uuidv4(),
            stockId: tracked.id,
            connectionId: connection.id,
            plaidTransactionId: txn.investment_transaction_id,
            buyDate: txn.date,
            quantity,
            originalQuantity: quantity,
            priceCents,
            feesCents,
            source: 'plaid',
            createdAt: now,
          }).run();
        }

        // For sell transactions, apply FIFO
        if (type === 'sell' && quantity > 0) {
          applyFifoSell(tracked.id, quantity);
        }
      }
    } catch (err) {
      console.error('[Plaid] transaction fetch error:', err);
      result.errors.push(`Transaction fetch: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Recompute average cost basis from remaining lots for synced stocks
    for (const s of result.synced) {
      const tracked = symbolMap.get(s.symbol);
      if (!tracked) continue;
      recomputeCostBasisFromLots(tracked.id);
    }

    // Update connection last_synced_at
    db.update(plaidConnections).set({ lastSyncedAt: now }).where(eq(plaidConnections.id, connection.id)).run();

    res.json(result);
  } catch (err) {
    console.error('[Plaid] sync error:', err);
    res.status(500).json({ error: 'Failed to sync from Plaid' });
  }
});

// ── GET /connections ──
router.get('/connections', (_req: Request, res: Response) => {
  try {
    const connections = db.select({
      id: plaidConnections.id,
      institutionName: plaidConnections.institutionName,
      institutionId: plaidConnections.institutionId,
      accountsJson: plaidConnections.accountsJson,
      lastSyncedAt: plaidConnections.lastSyncedAt,
      createdAt: plaidConnections.createdAt,
    }).from(plaidConnections).all();

    res.json(connections);
  } catch (err) {
    console.error('[Plaid] list connections error:', err);
    res.status(500).json({ error: 'Failed to list connections' });
  }
});

// ── DELETE /connections/:id ──
router.delete('/connections/:id', (req: Request, res: Response) => {
  try {
    const connection = db.select().from(plaidConnections).where(eq(plaidConnections.id, req.params.id as string)).get();
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    // Clear plaid fields on stocks linked to this connection
    const linkedStocks = db.select().from(stocks)
      .where(eq(stocks.plaidAccountId, connection.id))
      .all();
    for (const s of linkedStocks) {
      db.update(stocks).set({
        plaidAccountId: null,
        syncSource: 'manual',
        lastPlaidSyncAt: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(stocks.id, s.id)).run();
    }

    db.delete(plaidConnections).where(eq(plaidConnections.id, connection.id)).run();
    res.json({ success: true });
  } catch (err) {
    console.error('[Plaid] delete connection error:', err);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// ── FIFO sell helper ──
function applyFifoSell(stockId: string, sellQuantity: number) {
  // Get lots ordered by buy_date ASC (oldest first = FIFO)
  const lots = db.select().from(stockLots)
    .where(eq(stockLots.stockId, stockId))
    .orderBy(stockLots.buyDate)
    .all();

  let remaining = sellQuantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    if (lot.quantity <= 0) continue;

    if (lot.quantity <= remaining) {
      // Fully consume this lot
      remaining -= lot.quantity;
      db.update(stockLots).set({ quantity: 0 }).where(eq(stockLots.id, lot.id)).run();
    } else {
      // Partially consume this lot
      db.update(stockLots).set({ quantity: lot.quantity - remaining }).where(eq(stockLots.id, lot.id)).run();
      remaining = 0;
    }
  }
}

// ── Recompute avg cost basis from remaining lots ──
function recomputeCostBasisFromLots(stockId: string) {
  const lots = db.select().from(stockLots)
    .where(eq(stockLots.stockId, stockId))
    .all()
    .filter((l) => l.quantity > 0);

  if (lots.length === 0) return;

  const totalCost = lots.reduce((sum, l) => sum + l.quantity * l.priceCents, 0);
  const totalShares = lots.reduce((sum, l) => sum + l.quantity, 0);

  if (totalShares > 0) {
    const avgCostBasis = Math.round(totalCost / totalShares);
    db.update(stocks).set({ averageCostBasis: avgCostBasis }).where(eq(stocks.id, stockId)).run();
  }
}

export default router;
