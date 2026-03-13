import { Router, Request, Response } from 'express';
import { db } from '../../../db/index.js';
import { snapshots, entries } from '../../../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { getMembers, getCategories } from '../../../lib/config.js';
import type { TrendDataPoint, InsightsSummary, MemberNetWorth } from '@networth/shared';

const router = Router();

// GET /api/insights/trends — time-series data for charting
router.get('/trends', (_req: Request, res: Response) => {
  try {
    const membersConfig = getMembers();
    const allSnapshots = db.select().from(snapshots).orderBy(asc(snapshots.date)).all();

    const trends: TrendDataPoint[] = allSnapshots.map((snap) => {
      const snapshotEntries = db
        .select()
        .from(entries)
        .where(eq(entries.snapshotId, snap.id))
        .all();

      const byMember: Record<string, number> = {};
      for (const member of membersConfig.members) {
        byMember[member.id] = snapshotEntries
          .filter((e) => e.memberId === member.id)
          .reduce((sum, e) => sum + e.value, 0);
      }

      const byCategory: Record<string, number> = {};
      for (const e of snapshotEntries) {
        byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.value;
      }

      const combined = snapshotEntries.reduce((sum, e) => sum + e.value, 0);

      return {
        date: snap.date,
        snapshotId: snap.id,
        combined,
        byMember,
        byCategory,
      };
    });

    res.json(trends);
  } catch (err) {
    console.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /api/insights/summary — current totals, changes, breakdown
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const membersConfig = getMembers();
    const categoriesConfig = getCategories();

    const allSnapshots = db.select().from(snapshots).orderBy(asc(snapshots.date)).all();

    if (allSnapshots.length === 0) {
      const empty: InsightsSummary = {
        currentNetWorth: 0,
        previousNetWorth: 0,
        change: 0,
        changePercent: 0,
        byMember: [],
        byCategory: [],
      };
      res.json(empty);
      return;
    }

    const latest = allSnapshots[allSnapshots.length - 1];
    const previous = allSnapshots.length > 1 ? allSnapshots[allSnapshots.length - 2] : null;

    const latestEntries = db.select().from(entries).where(eq(entries.snapshotId, latest.id)).all();

    // Per-member breakdown
    const byMember: MemberNetWorth[] = membersConfig.members.map((member) => {
      const memberEntries = latestEntries.filter((e) => e.memberId === member.id);
      const totalAssets = memberEntries.filter((e) => e.type === 'asset').reduce((s, e) => s + e.value, 0);
      const totalLiabilities = memberEntries.filter((e) => e.type === 'liability').reduce((s, e) => s + e.value, 0);
      return {
        memberId: member.id,
        memberName: member.name,
        memberColor: member.color,
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets + totalLiabilities,
      };
    });

    // Per-category breakdown
    const allCategories = [
      ...categoriesConfig.assetCategories.map((c) => ({ ...c, type: 'asset' as const })),
      ...categoriesConfig.liabilityCategories.map((c) => ({ ...c, type: 'liability' as const })),
    ];

    const byCategory = allCategories.map((cat) => {
      const catEntries = latestEntries.filter((e) => e.categoryId === cat.id);
      const total = catEntries.reduce((s, e) => s + e.value, 0);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        type: cat.type,
        total,
      };
    }).filter((c) => c.total !== 0);

    const currentNetWorth = latestEntries.reduce((s, e) => s + e.value, 0);

    let previousNetWorth = 0;
    if (previous) {
      const prevEntries = db.select().from(entries).where(eq(entries.snapshotId, previous.id)).all();
      previousNetWorth = prevEntries.reduce((s, e) => s + e.value, 0);
    }

    const change = currentNetWorth - previousNetWorth;
    const changePercent = previousNetWorth !== 0 ? (change / Math.abs(previousNetWorth)) * 100 : 0;

    const summary: InsightsSummary = {
      currentNetWorth,
      previousNetWorth,
      change,
      changePercent,
      byMember,
      byCategory,
    };

    res.json(summary);
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
