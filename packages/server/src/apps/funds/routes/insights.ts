import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import type {
  BearishSignal,
  ConcentratedBet,
  ConsensusMove,
  FundMoveRef,
  FundsInsightsResponse,
  HoldingChangeType,
} from '@networth/shared';
import { db } from '../../../db/index.js';
import { funds } from '../../../db/schema.js';
import {
  aggregateBySecurity,
  classifyMove,
  latestTwoFilings,
  sentimentOf,
  type SecurityPosition,
} from '../lib/aggregation.js';

const router = Router();

interface SecurityMove {
  fundId: string;
  fundName: string;
  changeType: HoldingChangeType;
  sharesChangePercent: number | null;
  current: SecurityPosition | null;
  previous: SecurityPosition | null;
}

interface SecurityGroup {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  stockId: string | null;
  moves: SecurityMove[];
}

const CONCENTRATION_LIMIT = 25;

// GET /api/funds/insights — cross-fund signals derived on the fly from latest filings
router.get('/insights', (_req: Request, res: Response) => {
  try {
    const fundRows = db.select().from(funds).where(eq(funds.status, 'active')).all();
    const groups = new Map<string, SecurityGroup>();
    let latestPeriod = '';
    let quarterLabel: string | null = null;

    for (const fund of fundRows) {
      const { latest, previous } = latestTwoFilings(fund.id);
      if (!latest) continue;
      if (latest.periodOfReport > latestPeriod) {
        latestPeriod = latest.periodOfReport;
        quarterLabel = latest.quarter;
      }

      const current = aggregateBySecurity(latest.id);
      const prior = previous ? aggregateBySecurity(previous.id) : new Map<string, SecurityPosition>();
      const keys = new Set<string>([...current.keys(), ...prior.keys()]);

      for (const key of keys) {
        const cur = current.get(key);
        const pre = prior.get(key);
        const { changeType, sharesChangePercent } = classifyMove(pre, cur);
        const base = cur ?? pre!;

        let group = groups.get(key);
        if (!group) {
          group = {
            cusip: base.cusip,
            issuerName: base.issuerName,
            ticker: base.ticker,
            stockId: base.stockId,
            moves: [],
          };
          groups.set(key, group);
        }
        if (!group.ticker && base.ticker) {
          group.ticker = base.ticker;
          group.stockId = base.stockId;
        }
        group.moves.push({
          fundId: fund.id,
          fundName: fund.name,
          changeType,
          sharesChangePercent,
          current: cur ?? null,
          previous: pre ?? null,
        });
      }
    }

    const moveRef = (g: SecurityGroup, m: SecurityMove): FundMoveRef => ({
      fundId: m.fundId,
      fundName: m.fundName,
      changeType: m.changeType,
      sharesChangePercent: m.sharesChangePercent,
      valueChangeCents: m.previous
        ? (m.current?.totalValueCents ?? 0) - m.previous.totalValueCents
        : null,
      toValueCents: m.current?.totalValueCents ?? 0,
      toPctOfPortfolio: m.current?.pctOfPortfolio ?? 0,
    });

    const consensusFrom = (
      g: SecurityGroup,
      predicate: (m: SecurityMove) => boolean,
    ): ConsensusMove | null => {
      const matching = g.moves.filter(predicate);
      if (matching.length < 2) return null;
      return {
        cusip: g.cusip,
        issuerName: g.issuerName,
        ticker: g.ticker,
        stockId: g.stockId,
        isTracked: !!g.stockId,
        fundCount: matching.length,
        totalValueCents: matching.reduce((s, m) => s + (m.current?.totalValueCents ?? 0), 0),
        funds: matching
          .map((m) => moveRef(g, m))
          .sort((a, b) => b.toValueCents - a.toValueCents),
      };
    };

    const clusterBuys: ConsensusMove[] = [];
    const newConsensus: ConsensusMove[] = [];
    const clusterExits: ConsensusMove[] = [];
    const bearishActivity: BearishSignal[] = [];
    const concentratedBets: ConcentratedBet[] = [];
    const trackedOverlap: ConsensusMove[] = [];

    for (const g of groups.values()) {
      const buys = consensusFrom(g, (m) => m.changeType === 'new' || m.changeType === 'add');
      if (buys) clusterBuys.push(buys);

      const news = consensusFrom(g, (m) => m.changeType === 'new');
      if (news) newConsensus.push(news);

      const exits = consensusFrom(g, (m) => m.changeType === 'exit' || m.changeType === 'trim');
      if (exits) clusterExits.push(exits);

      // Bearish (put) exposure across funds in the current quarter.
      const putFunds = g.moves
        .filter((m) => (m.current?.bearishValueCents ?? 0) > 0)
        .map((m) => ({
          fundId: m.fundId,
          fundName: m.fundName,
          putValueCents: m.current!.bearishValueCents,
        }));
      if (putFunds.length > 0) {
        bearishActivity.push({
          cusip: g.cusip,
          issuerName: g.issuerName,
          ticker: g.ticker,
          stockId: g.stockId,
          fundCount: putFunds.length,
          putValueCents: putFunds.reduce((s, f) => s + f.putValueCents, 0),
          funds: putFunds.sort((a, b) => b.putValueCents - a.putValueCents),
        });
      }

      // Overlap with tracked stocks: any active move (non-hold) on a tracked name.
      if (g.stockId) {
        const overlap = consensusFrom(g, () => true);
        const activeMoves = g.moves.filter((m) => m.changeType !== 'hold');
        if (activeMoves.length > 0) {
          trackedOverlap.push({
            cusip: g.cusip,
            issuerName: g.issuerName,
            ticker: g.ticker,
            stockId: g.stockId,
            isTracked: true,
            fundCount: g.moves.length,
            totalValueCents: g.moves.reduce((s, m) => s + (m.current?.totalValueCents ?? 0), 0),
            funds: g.moves.map((m) => moveRef(g, m)).sort((a, b) => b.toValueCents - a.toValueCents),
          });
        }
        void overlap;
      }

      // Concentrated single-fund bets.
      for (const m of g.moves) {
        if (!m.current) continue;
        concentratedBets.push({
          cusip: g.cusip,
          issuerName: g.issuerName,
          ticker: g.ticker,
          stockId: g.stockId,
          fundId: m.fundId,
          fundName: m.fundName,
          pctOfPortfolio: m.current.pctOfPortfolio,
          valueCents: m.current.totalValueCents,
          sentiment: sentimentOf(m.current.bullishValueCents, m.current.bearishValueCents),
        });
      }
    }

    clusterBuys.sort((a, b) => b.fundCount - a.fundCount || b.totalValueCents - a.totalValueCents);
    newConsensus.sort((a, b) => b.fundCount - a.fundCount || b.totalValueCents - a.totalValueCents);
    clusterExits.sort((a, b) => b.fundCount - a.fundCount || b.totalValueCents - a.totalValueCents);
    bearishActivity.sort((a, b) => b.putValueCents - a.putValueCents);
    trackedOverlap.sort((a, b) => b.totalValueCents - a.totalValueCents);
    concentratedBets.sort((a, b) => b.pctOfPortfolio - a.pctOfPortfolio);

    const response: FundsInsightsResponse = {
      quarterLabel,
      clusterBuys,
      newConsensus,
      clusterExits,
      bearishActivity,
      concentratedBets: concentratedBets.slice(0, CONCENTRATION_LIMIT),
      trackedOverlap,
    };
    res.json(response);
  } catch (err) {
    console.error('Error building insights:', err);
    res.status(500).json({ error: 'Failed to build insights' });
  }
});

export default router;
