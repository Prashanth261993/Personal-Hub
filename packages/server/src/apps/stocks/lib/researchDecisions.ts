import { desc, eq } from 'drizzle-orm';
import type {
  ResearchDecision,
  ResearchPriceZone,
  StockResearchDecisionRecord,
  StockResearchStatus,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { stockResearchDecisions } from '../../../db/schema.js';

const SIGNALS = ['strong', 'neutral', 'caution'];
const ACTIONS = ['strong-buy', 'buy', 'accumulate', 'hold', 'trim', 'sell', 'avoid'];
const CONVICTIONS = ['high', 'medium', 'low'];
const MODES = ['full', 'refresh', 'earnings'];
const LEVEL_TYPES = ['support', 'resistance', 'fair-value', 'review'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = typeof stockResearchDecisions.$inferSelect;

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optNum(value: unknown): number | null {
  return isNum(value) ? value : null;
}

/** Validates and normalizes a decision.json payload. Returns a list of errors when invalid. */
export function validateDecision(input: unknown, expectedSymbol: string): { decision?: ResearchDecision; errors: string[] } {
  const errors: string[] = [];
  const d = (input ?? {}) as Record<string, any>;

  if (typeof d.symbol !== 'string' || d.symbol.trim().toUpperCase() !== expectedSymbol) {
    errors.push(`symbol must match the stock symbol (${expectedSymbol})`);
  }
  if (typeof d.asOf !== 'string' || !DATE_RE.test(d.asOf)) errors.push('asOf must be YYYY-MM-DD');
  if (!isNum(d.priceAtAnalysis) || d.priceAtAnalysis <= 0) errors.push('priceAtAnalysis must be a positive number (dollars)');
  if (!SIGNALS.includes(d.signal)) errors.push(`signal must be one of ${SIGNALS.join('|')}`);
  if (!ACTIONS.includes(d.action)) errors.push(`action must be one of ${ACTIONS.join('|')}`);
  if (!CONVICTIONS.includes(d.conviction)) errors.push(`conviction must be one of ${CONVICTIONS.join('|')}`);

  const fv = d.fairValue ?? {};
  if (!isNum(fv.low) || !isNum(fv.mid) || !isNum(fv.high) || !(fv.low <= fv.mid && fv.mid <= fv.high)) {
    errors.push('fairValue must have numeric low <= mid <= high');
  }

  const z = d.zones ?? {};
  if (!isNum(z.buyBelow) || !isNum(z.accumulateBelow) || !isNum(z.trimAbove) || !isNum(z.sellAbove)) {
    errors.push('zones must have numeric buyBelow, accumulateBelow, trimAbove, sellAbove');
  } else if (!(z.buyBelow <= z.accumulateBelow && z.accumulateBelow <= z.trimAbove && z.trimAbove <= z.sellAbove)) {
    errors.push('zones must be ordered: buyBelow <= accumulateBelow <= trimAbove <= sellAbove');
  }

  if (!Array.isArray(d.scenarios) || d.scenarios.length < 2) {
    errors.push('scenarios must be an array with at least 2 entries');
  } else {
    const bad = d.scenarios.some((s: any) => typeof s?.name !== 'string' || !isNum(s?.probability) || !isNum(s?.price12m));
    if (bad) errors.push('each scenario needs name, probability (0..1) and price12m');
    const total = d.scenarios.reduce((sum: number, s: any) => sum + (isNum(s?.probability) ? s.probability : 0), 0);
    if (Math.abs(total - 1) > 0.011) errors.push(`scenario probabilities must sum to 1 (got ${total.toFixed(3)})`);
  }

  if (!isNum(d.expectedPrice12m)) errors.push('expectedPrice12m must be a number (dollars)');
  if (d.nextReviewDate != null && (typeof d.nextReviewDate !== 'string' || !DATE_RE.test(d.nextReviewDate))) {
    errors.push('nextReviewDate must be YYYY-MM-DD or null');
  }

  if (errors.length > 0) return { errors };

  const decision: ResearchDecision = {
    schemaVersion: 1,
    symbol: expectedSymbol,
    asOf: d.asOf,
    priceAtAnalysis: d.priceAtAnalysis,
    mode: MODES.includes(d.mode) ? d.mode : 'full',
    signal: d.signal,
    action: d.action,
    conviction: d.conviction,
    fairValue: { low: fv.low, mid: fv.mid, high: fv.high },
    marginOfSafetyPct: optNum(d.marginOfSafetyPct),
    scenarios: d.scenarios.map((s: any) => ({
      name: s.name,
      probability: s.probability,
      price12m: s.price12m,
      price3y: optNum(s.price3y),
      driver: typeof s.driver === 'string' ? s.driver : '',
    })),
    expectedPrice12m: d.expectedPrice12m,
    expectedReturn12mPct: optNum(d.expectedReturn12mPct),
    zones: { buyBelow: z.buyBelow, accumulateBelow: z.accumulateBelow, trimAbove: z.trimAbove, sellAbove: z.sellAbove },
    levels: Array.isArray(d.levels)
      ? d.levels
          .filter((l: any) => isNum(l?.price))
          .map((l: any) => ({
            price: l.price,
            type: LEVEL_TYPES.includes(l.type) ? l.type : 'support',
            label: typeof l.label === 'string' ? l.label : '',
          }))
      : [],
    thesisBreakers: Array.isArray(d.thesisBreakers) ? d.thesisBreakers.filter((t: unknown) => typeof t === 'string') : [],
    reviewPriceBelow: optNum(d.reviewPriceBelow),
    nextReviewDate: d.nextReviewDate ?? null,
    scorecard: typeof d.scorecard === 'object' && d.scorecard !== null
      ? Object.fromEntries(Object.entries(d.scorecard).filter(([, v]) => isNum(v)).map(([k, v]) => [k, Math.max(-2, Math.min(2, v as number))]))
      : {},
    reportPath: typeof d.reportPath === 'string' ? d.reportPath : null,
  };

  return { decision, errors };
}

export function toDecisionRecord(row: Row): StockResearchDecisionRecord {
  return {
    id: row.id,
    stockId: row.stockId,
    asOf: row.asOf,
    decision: JSON.parse(row.payload) as ResearchDecision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getDecisionsForStock(stockId: string): StockResearchDecisionRecord[] {
  return db.select().from(stockResearchDecisions)
    .where(eq(stockResearchDecisions.stockId, stockId))
    .orderBy(desc(stockResearchDecisions.asOf))
    .all()
    .map(toDecisionRecord);
}

/** Latest decision (by asOf) per stock. */
export function getLatestDecisionMap(): Map<string, StockResearchDecisionRecord> {
  const rows = db.select().from(stockResearchDecisions).orderBy(desc(stockResearchDecisions.asOf)).all();
  const map = new Map<string, StockResearchDecisionRecord>();
  for (const row of rows) {
    if (!map.has(row.stockId)) map.set(row.stockId, toDecisionRecord(row));
  }
  return map;
}

export function priceZoneFor(decision: ResearchDecision, price: number): ResearchPriceZone {
  const { zones } = decision;
  if (price < zones.buyBelow) return 'buy';
  if (price < zones.accumulateBelow) return 'accumulate';
  if (price > zones.sellAbove) return 'sell';
  if (price > zones.trimAbove) return 'trim';
  return 'hold';
}

/** Evaluates the latest decision against the current cached price (cents). */
export function buildResearchStatus(
  record: StockResearchDecisionRecord | undefined,
  currentPriceCents: number | null,
  today: string = new Date().toISOString().slice(0, 10),
): StockResearchStatus | null {
  if (!record) return null;
  const { decision } = record;
  const price = currentPriceCents ? currentPriceCents / 100 : null;
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(decision.asOf)) / 86_400_000));

  return {
    latest: record,
    currentPrice: price,
    priceZone: price !== null ? priceZoneFor(decision, price) : null,
    fairValueUpsidePercent: price !== null ? Number((((decision.fairValue.mid - price) / price) * 100).toFixed(2)) : null,
    belowReviewPrice: price !== null && decision.reviewPriceBelow !== null && price < decision.reviewPriceBelow,
    reviewDue: decision.nextReviewDate !== null && decision.nextReviewDate <= today,
    daysSinceAnalysis: Number.isFinite(days) ? days : 0,
  };
}
