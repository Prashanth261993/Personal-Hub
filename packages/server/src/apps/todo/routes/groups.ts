import { Router, Request, Response } from 'express';
import { db } from '../../../db/index.js';
import { todoGroups } from '../../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { TodoGroup, CreateGroupRequest, UpdateGroupRequest } from '@networth/shared';

const router = Router();

function paramId(req: Request): string {
  return req.params.id as string;
}

// GET /api/todo/groups — list all groups ordered by sort_order
router.get('/', (_req: Request, res: Response) => {
  try {
    const groups = db
      .select()
      .from(todoGroups)
      .orderBy(todoGroups.sortOrder)
      .all();

    res.json(groups);
  } catch (err) {
    console.error('Error fetching todo groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// POST /api/todo/groups — create a new group
router.post('/', (req: Request, res: Response) => {
  try {
    const body: CreateGroupRequest = req.body;

    if (!body.name || !body.color || !body.icon) {
      res.status(400).json({ error: 'name, color, and icon are required' });
      return;
    }

    // Get max sort_order
    const maxResult = db
      .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(todoGroups)
      .get();
    const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

    const group: TodoGroup = {
      id: uuidv4(),
      name: body.name,
      color: body.color,
      icon: body.icon,
      sortOrder: nextOrder,
      createdAt: new Date().toISOString(),
    };

    db.insert(todoGroups).values(group).run();
    res.status(201).json(group);
  } catch (err) {
    console.error('Error creating todo group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// PUT /api/todo/groups/reorder — batch reorder groups
router.put('/reorder', (req: Request, res: Response) => {
  try {
    const { groups } = req.body as { groups: { id: string; sortOrder: number }[] };

    if (!groups || !Array.isArray(groups)) {
      res.status(400).json({ error: 'groups array is required' });
      return;
    }

    for (const g of groups) {
      db.update(todoGroups)
        .set({ sortOrder: g.sortOrder })
        .where(eq(todoGroups.id, g.id))
        .run();
    }

    const updated = db.select().from(todoGroups).orderBy(todoGroups.sortOrder).all();
    res.json(updated);
  } catch (err) {
    console.error('Error reordering groups:', err);
    res.status(500).json({ error: 'Failed to reorder groups' });
  }
});

// PUT /api/todo/groups/:id — update a group
router.put('/:id', (req: Request, res: Response) => {
  try {
    const group = db.select().from(todoGroups).where(eq(todoGroups.id, paramId(req))).get();
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const body: UpdateGroupRequest = req.body;
    db.update(todoGroups)
      .set({
        name: body.name ?? group.name,
        color: body.color ?? group.color,
        icon: body.icon ?? group.icon,
      })
      .where(eq(todoGroups.id, paramId(req)))
      .run();

    const updated = db.select().from(todoGroups).where(eq(todoGroups.id, paramId(req))).get();
    res.json(updated);
  } catch (err) {
    console.error('Error updating todo group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/todo/groups/:id — delete a group (CASCADE deletes todos)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const group = db.select().from(todoGroups).where(eq(todoGroups.id, paramId(req))).get();
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    db.delete(todoGroups).where(eq(todoGroups.id, paramId(req))).run();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting todo group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
