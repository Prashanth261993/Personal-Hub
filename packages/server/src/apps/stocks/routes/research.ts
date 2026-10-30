import { Router, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/index.js';
import { stockResearchDecisions, stocks } from '../../../db/schema.js';
import { getDecisionsForStock, toDecisionRecord, validateDecision } from '../lib/researchDecisions.js';

const router = Router();

router.get('/:id/decisions', (req: Request, res: Response) => {
  try {
    const stock = db.select().from(stocks).where(eq(stocks.id, req.params.id as string)).get();
    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }
    res.json(getDecisionsForStock(stock.id));
  } catch (err) {
    console.error('Error fetching research decisions:', err);
    res.status(500).json({ error: 'Failed to fetch research decisions' });
  }
});

// Upserts by (stock, asOf): re-running research on the same day replaces that day's verdict.
router.post('/:id/decisions', (req: Request, res: Response) => {
  try {
    const stock = db.select().from(stocks).where(eq(stocks.id, req.params.id as string)).get();
    if (!stock) {
      res.status(404).json({ error: 'Stock not found' });
      return;
    }

    const { decision, errors } = validateDecision(req.body, stock.symbol);
    if (!decision) {
      res.status(400).json({ error: `Invalid decision: ${errors.join('; ')}` });
      return;
    }

    const now = new Date().toISOString();
    const existing = db.select().from(stockResearchDecisions)
      .where(and(eq(stockResearchDecisions.stockId, stock.id), eq(stockResearchDecisions.asOf, decision.asOf)))
      .get();

    if (existing) {
      db.update(stockResearchDecisions).set({
        action: decision.action,
        conviction: decision.conviction,
        payload: JSON.stringify(decision),
        updatedAt: now,
      }).where(eq(stockResearchDecisions.id, existing.id)).run();
    } else {
      db.insert(stockResearchDecisions).values({
        id: uuidv4(),
        stockId: stock.id,
        asOf: decision.asOf,
        action: decision.action,
        conviction: decision.conviction,
        payload: JSON.stringify(decision),
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    const saved = db.select().from(stockResearchDecisions)
      .where(and(eq(stockResearchDecisions.stockId, stock.id), eq(stockResearchDecisions.asOf, decision.asOf)))
      .get();
    res.status(existing ? 200 : 201).json(toDecisionRecord(saved!));
  } catch (err) {
    console.error('Error saving research decision:', err);
    res.status(500).json({ error: 'Failed to save research decision' });
  }
});

router.delete('/:id/decisions/:decisionId', (req: Request, res: Response) => {
  try {
    const result = db.delete(stockResearchDecisions)
      .where(and(
        eq(stockResearchDecisions.id, req.params.decisionId as string),
        eq(stockResearchDecisions.stockId, req.params.id as string),
      ))
      .run();
    if (result.changes === 0) {
      res.status(404).json({ error: 'Decision not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting research decision:', err);
    res.status(500).json({ error: 'Failed to delete research decision' });
  }
});

export default router;
