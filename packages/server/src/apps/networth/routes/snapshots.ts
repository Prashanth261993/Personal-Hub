import { Router, Request, Response } from 'express';
import { db } from '../../../db/index.js';
import { snapshots, entries } from '../../../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { SnapshotSummary, SnapshotDetail, CreateSnapshotRequest, UpdateSnapshotRequest } from '@networth/shared';

const router = Router();

function paramId(req: Request): string {
  return req.params.id as string;
}

// GET /api/snapshots — list all snapshots with summary totals
router.get('/', (_req: Request, res: Response) => {
  try {
    const allSnapshots = db.select().from(snapshots).orderBy(desc(snapshots.date)).all();

    const summaries: SnapshotSummary[] = allSnapshots.map((snap) => {
      const snapshotEntries = db
        .select()
        .from(entries)
        .where(eq(entries.snapshotId, snap.id))
        .all();

      const totalAssets = snapshotEntries
        .filter((e) => e.type === 'asset')
        .reduce((sum, e) => sum + e.value, 0);

      const totalLiabilities = snapshotEntries
        .filter((e) => e.type === 'liability')
        .reduce((sum, e) => sum + e.value, 0);

      return {
        id: snap.id,
        date: snap.date,
        note: snap.note,
        createdAt: snap.createdAt,
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets + totalLiabilities, // liabilities are already negative
      };
    });

    res.json(summaries);
  } catch (err) {
    console.error('Error fetching snapshots:', err);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// GET /api/snapshots/:id — get snapshot with all entries
router.get('/:id', (req: Request, res: Response) => {
  try {
    const snap = db.select().from(snapshots).where(eq(snapshots.id, paramId(req))).get();

    if (!snap) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const snapshotEntries = db
      .select()
      .from(entries)
      .where(eq(entries.snapshotId, snap.id))
      .all();

    const detail: SnapshotDetail = {
      ...snap,
      entries: snapshotEntries,
    };

    res.json(detail);
  } catch (err) {
    console.error('Error fetching snapshot:', err);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

// POST /api/snapshots — create a new snapshot
router.post('/', (req: Request, res: Response) => {
  try {
    const body: CreateSnapshotRequest = req.body;

    if (!body.date || !body.entries || !Array.isArray(body.entries)) {
      res.status(400).json({ error: 'date and entries[] are required' });
      return;
    }

    const snapshotId = uuidv4();
    const now = new Date().toISOString();

    db.insert(snapshots).values({
      id: snapshotId,
      date: body.date,
      note: body.note || null,
      createdAt: now,
    }).run();

    for (const entry of body.entries) {
      db.insert(entries).values({
        id: uuidv4(),
        snapshotId,
        memberId: entry.memberId,
        categoryId: entry.categoryId,
        type: entry.type,
        name: entry.name,
        value: entry.value, // already in cents, negative for liabilities
      }).run();
    }

    const detail: SnapshotDetail = {
      id: snapshotId,
      date: body.date,
      note: body.note || null,
      createdAt: now,
      entries: db.select().from(entries).where(eq(entries.snapshotId, snapshotId)).all(),
    };

    res.status(201).json(detail);
  } catch (err) {
    console.error('Error creating snapshot:', err);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// PUT /api/snapshots/:id — update snapshot (replace all entries)
router.put('/:id', (req: Request, res: Response) => {
  try {
    const snap = db.select().from(snapshots).where(eq(snapshots.id, paramId(req))).get();

    if (!snap) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const body: UpdateSnapshotRequest = req.body;

    // Update snapshot metadata if provided
    if (body.date || body.note !== undefined) {
      db.update(snapshots)
        .set({
          date: body.date || snap.date,
          note: body.note !== undefined ? body.note : snap.note,
        })
        .where(eq(snapshots.id, snap.id))
        .run();
    }

    // Replace all entries if provided
    if (body.entries) {
      // Delete existing entries
      db.delete(entries).where(eq(entries.snapshotId, snap.id)).run();

      // Insert new entries
      for (const entry of body.entries) {
        db.insert(entries).values({
          id: uuidv4(),
          snapshotId: snap.id,
          memberId: entry.memberId,
          categoryId: entry.categoryId,
          type: entry.type,
          name: entry.name,
          value: entry.value,
        }).run();
      }
    }

    const updatedSnap = db.select().from(snapshots).where(eq(snapshots.id, snap.id)).get()!;
    const updatedEntries = db.select().from(entries).where(eq(entries.snapshotId, snap.id)).all();

    res.json({ ...updatedSnap, entries: updatedEntries });
  } catch (err) {
    console.error('Error updating snapshot:', err);
    res.status(500).json({ error: 'Failed to update snapshot' });
  }
});

// DELETE /api/snapshots/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const snap = db.select().from(snapshots).where(eq(snapshots.id, paramId(req))).get();

    if (!snap) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    // Entries deleted via CASCADE
    db.delete(snapshots).where(eq(snapshots.id, snap.id)).run();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting snapshot:', err);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

// POST /api/snapshots/:id/carry-forward — clone entries into a new snapshot
router.post('/:id/carry-forward', (req: Request, res: Response) => {
  try {
    const sourceSnap = db.select().from(snapshots).where(eq(snapshots.id, paramId(req))).get();

    if (!sourceSnap) {
      res.status(404).json({ error: 'Source snapshot not found' });
      return;
    }

    const { date, note } = req.body;
    if (!date) {
      res.status(400).json({ error: 'date is required for the new snapshot' });
      return;
    }

    const newSnapshotId = uuidv4();
    const now = new Date().toISOString();

    db.insert(snapshots).values({
      id: newSnapshotId,
      date,
      note: note || null,
      createdAt: now,
    }).run();

    const sourceEntries = db.select().from(entries).where(eq(entries.snapshotId, sourceSnap.id)).all();

    for (const entry of sourceEntries) {
      db.insert(entries).values({
        id: uuidv4(),
        snapshotId: newSnapshotId,
        memberId: entry.memberId,
        categoryId: entry.categoryId,
        type: entry.type,
        name: entry.name,
        value: entry.value,
      }).run();
    }

    const detail: SnapshotDetail = {
      id: newSnapshotId,
      date,
      note: note || null,
      createdAt: now,
      entries: db.select().from(entries).where(eq(entries.snapshotId, newSnapshotId)).all(),
    };

    res.status(201).json(detail);
  } catch (err) {
    console.error('Error carrying forward snapshot:', err);
    res.status(500).json({ error: 'Failed to carry forward snapshot' });
  }
});

export default router;
