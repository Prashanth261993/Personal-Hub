import { Router, Request, Response } from 'express';
import { db } from '../../../db/index.js';
import { todos, recurringCompletions } from '../../../db/schema.js';
import { eq, and, sql, desc, lte, gte, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  Todo,
  TodoSummary,
  CreateTodoRequest,
  UpdateTodoRequest,
  MoveTodoRequest,
  BatchReorderRequest,
  RecurrenceRule,
} from '@networth/shared';

const router = Router();

function paramId(req: Request): string {
  return req.params.id as string;
}

function parseRecurrence(json: string | null): RecurrenceRule | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function serializeRecurrence(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  return JSON.stringify(rule);
}

function toTodo(row: typeof todos.$inferSelect): Todo {
  return {
    ...row,
    priority: row.priority as Todo['priority'],
    status: row.status as Todo['status'],
    recurrence: parseRecurrence(row.recurrence),
  };
}

function buildSummaries(rows: (typeof todos.$inferSelect)[]): TodoSummary[] {
  // Separate parents and subtasks
  const parentRows = rows.filter(r => !r.parentId);
  const subtaskRows = rows.filter(r => r.parentId);

  // Count subtasks per parent
  const subtaskCounts = new Map<string, { total: number; completed: number }>();
  for (const st of subtaskRows) {
    const entry = subtaskCounts.get(st.parentId!) || { total: 0, completed: 0 };
    entry.total++;
    if (st.status === 'completed') entry.completed++;
    subtaskCounts.set(st.parentId!, entry);
  }

  return parentRows.map(row => {
    const counts = subtaskCounts.get(row.id) || { total: 0, completed: 0 };
    return {
      id: row.id,
      groupId: row.groupId,
      title: row.title,
      priority: row.priority as Todo['priority'],
      status: row.status as Todo['status'],
      dueDate: row.dueDate,
      recurrence: parseRecurrence(row.recurrence),
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      subtaskCount: counts.total,
      subtaskCompletedCount: counts.completed,
    };
  });
}

// GET /api/todo/todos — list todos (filterable)
router.get('/', (req: Request, res: Response) => {
  try {
    const { groupId, status, priority, dueBefore, dueAfter } = req.query;

    const conditions = [];
    if (groupId) conditions.push(eq(todos.groupId, groupId as string));
    if (status) conditions.push(eq(todos.status, status as 'open' | 'completed'));
    if (priority) conditions.push(eq(todos.priority, priority as 'high' | 'medium' | 'low'));
    if (dueBefore) conditions.push(lte(todos.dueDate, dueBefore as string));
    if (dueAfter) conditions.push(gte(todos.dueDate, dueAfter as string));

    let allRows;
    if (conditions.length > 0) {
      allRows = db.select().from(todos).where(and(...conditions)).orderBy(todos.sortOrder).all();
    } else {
      allRows = db.select().from(todos).orderBy(todos.sortOrder).all();
    }

    const summaries = buildSummaries(allRows);
    res.json(summaries);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// GET /api/todo/todos/:id — full detail with subtasks
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!row) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const subtaskRows = db
      .select()
      .from(todos)
      .where(eq(todos.parentId, paramId(req)))
      .orderBy(todos.sortOrder)
      .all();

    const todo = toTodo(row);
    const subtasks = subtaskRows.map(toTodo);

    res.json({ ...todo, subtasks });
  } catch (err) {
    console.error('Error fetching todo:', err);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// POST /api/todo/todos — create a new todo
router.post('/', (req: Request, res: Response) => {
  try {
    const body: CreateTodoRequest = req.body;

    if (!body.groupId || !body.title) {
      res.status(400).json({ error: 'groupId and title are required' });
      return;
    }

    // Get max sort_order within the group
    const maxResult = db
      .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(todos)
      .where(and(
        eq(todos.groupId, body.groupId),
        body.parentId ? eq(todos.parentId, body.parentId) : isNull(todos.parentId)
      ))
      .get();
    const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

    const now = new Date().toISOString();
    const newTodo = {
      id: uuidv4(),
      groupId: body.groupId,
      title: body.title,
      description: body.description || null,
      priority: body.priority || 'medium',
      status: 'open' as const,
      dueDate: body.dueDate || null,
      recurrence: serializeRecurrence(body.recurrence),
      parentId: body.parentId || null,
      sortOrder: nextOrder,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(todos).values(newTodo).run();

    const result = toTodo({ ...newTodo, priority: newTodo.priority, status: newTodo.status });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating todo:', err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// PUT /api/todo/todos/:id — update a todo
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const body: UpdateTodoRequest = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.groupId !== undefined) updates.groupId = body.groupId;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.recurrence !== undefined) updates.recurrence = serializeRecurrence(body.recurrence);
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.status !== undefined) {
      updates.status = body.status;
      updates.completedAt = body.status === 'completed' ? now : null;
    }

    db.update(todos).set(updates).where(eq(todos.id, paramId(req))).run();

    const updated = db.select().from(todos).where(eq(todos.id, paramId(req))).get()!;
    res.json(toTodo(updated));
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// PUT /api/todo/todos/:id/move — move to different group
router.put('/:id/move', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const body: MoveTodoRequest = req.body;
    if (!body.groupId) {
      res.status(400).json({ error: 'groupId is required' });
      return;
    }

    db.update(todos)
      .set({
        groupId: body.groupId,
        sortOrder: body.sortOrder ?? 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(todos.id, paramId(req)))
      .run();

    const updated = db.select().from(todos).where(eq(todos.id, paramId(req))).get()!;
    res.json(toTodo(updated));
  } catch (err) {
    console.error('Error moving todo:', err);
    res.status(500).json({ error: 'Failed to move todo' });
  }
});

// PUT /api/todo/todos/:id/complete — mark complete (handle recurring)
router.put('/:id/complete', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const recurrence = parseRecurrence(existing.recurrence);

    if (recurrence) {
      // For recurring todos, log completion but keep status open
      db.insert(recurringCompletions)
        .values({
          id: uuidv4(),
          todoId: existing.id,
          completionDate: (req.body?.date as string) || today,
          completedAt: now,
        })
        .run();

      const updated = db.select().from(todos).where(eq(todos.id, paramId(req))).get()!;
      const completions = db
        .select()
        .from(recurringCompletions)
        .where(eq(recurringCompletions.todoId, existing.id))
        .all();

      res.json({ ...toTodo(updated), recurringCompletions: completions });
    } else {
      // Non-recurring: mark as completed
      db.update(todos)
        .set({ status: 'completed', completedAt: now, updatedAt: now })
        .where(eq(todos.id, paramId(req)))
        .run();

      const updated = db.select().from(todos).where(eq(todos.id, paramId(req))).get()!;
      res.json(toTodo(updated));
    }
  } catch (err) {
    console.error('Error completing todo:', err);
    res.status(500).json({ error: 'Failed to complete todo' });
  }
});

// PUT /api/todo/todos/:id/reopen — reopen a todo
router.put('/:id/reopen', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    db.update(todos)
      .set({ status: 'open', completedAt: null, updatedAt: new Date().toISOString() })
      .where(eq(todos.id, paramId(req)))
      .run();

    const updated = db.select().from(todos).where(eq(todos.id, paramId(req))).get()!;
    res.json(toTodo(updated));
  } catch (err) {
    console.error('Error reopening todo:', err);
    res.status(500).json({ error: 'Failed to reopen todo' });
  }
});

// PUT /api/todo/todos/reorder — batch reorder
router.put('/reorder', (req: Request, res: Response) => {
  try {
    const body: BatchReorderRequest = req.body;

    if (!body.todos || !Array.isArray(body.todos)) {
      res.status(400).json({ error: 'todos array is required' });
      return;
    }

    const now = new Date().toISOString();
    for (const item of body.todos) {
      const updates: Record<string, unknown> = { sortOrder: item.sortOrder, updatedAt: now };
      if (item.groupId) updates.groupId = item.groupId;
      db.update(todos).set(updates).where(eq(todos.id, item.id)).run();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering todos:', err);
    res.status(500).json({ error: 'Failed to reorder todos' });
  }
});

// DELETE /api/todo/todos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(todos).where(eq(todos.id, paramId(req))).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    db.delete(todos).where(eq(todos.id, paramId(req))).run();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

export default router;
