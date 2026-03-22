import { Router, Request, Response } from 'express';
import { db } from '../../../db/index.js';
import { todos, todoGroups, recurringCompletions } from '../../../db/schema.js';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import type { TodoStats, CalendarTodo, RecurrenceRule } from '@networth/shared';

const router = Router();

function parseRecurrence(json: string | null): RecurrenceRule | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

// GET /api/todo/stats — aggregate stats
router.get('/', (_req: Request, res: Response) => {
  try {
    // Use local date consistently to match client-side "today"
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const openCount = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(todos)
      .where(and(eq(todos.status, 'open'), sql`parent_id IS NULL`))
      .get()!.count;

    const completedCount = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(todos)
      .where(and(eq(todos.status, 'completed'), sql`parent_id IS NULL`))
      .get()!.count;

    // Completed today: non-recurring (currently completed with completedAt today)
    // plus recurring completions logged today
    const completedTodayNonRecurring = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(todos)
      .where(and(
        eq(todos.status, 'completed'),
        sql`date(completed_at, 'localtime') = ${today}`,
        sql`parent_id IS NULL`
      ))
      .get()!.count;

    const completedTodayRecurring = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recurringCompletions)
      .where(eq(recurringCompletions.completionDate, today))
      .get()!.count;

    const completedToday = completedTodayNonRecurring + completedTodayRecurring;

    // Completed this week (Mon-Sun)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

    const completedThisWeekNR = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(todos)
      .where(and(
        eq(todos.status, 'completed'),
        sql`date(completed_at, 'localtime') >= ${weekStart}`,
        sql`parent_id IS NULL`
      ))
      .get()!.count;

    const completedThisWeekRC = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recurringCompletions)
      .where(gte(recurringCompletions.completionDate, weekStart))
      .get()!.count;

    const completedThisWeek = completedThisWeekNR + completedThisWeekRC;

    // Daily completions for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

    const dailyNR = db
      .select({
        date: sql<string>`date(completed_at, 'localtime')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(todos)
      .where(and(
        eq(todos.status, 'completed'),
        sql`date(completed_at, 'localtime') >= ${thirtyDaysAgoStr}`,
        sql`parent_id IS NULL`
      ))
      .groupBy(sql`date(completed_at, 'localtime')`)
      .all();

    const dailyRC = db
      .select({
        date: recurringCompletions.completionDate,
        count: sql<number>`COUNT(*)`,
      })
      .from(recurringCompletions)
      .where(gte(recurringCompletions.completionDate, thirtyDaysAgoStr))
      .groupBy(recurringCompletions.completionDate)
      .all();

    // Merge daily counts
    const dailyMap = new Map<string, number>();
    for (const d of dailyNR) { dailyMap.set(d.date, (dailyMap.get(d.date) || 0) + d.count); }
    for (const d of dailyRC) { dailyMap.set(d.date, (dailyMap.get(d.date) || 0) + d.count); }

    const completionsByDay = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate streaks
    const allDates = new Set(completionsByDay.map(d => d.date));
    let currentStreak = 0;
    let longestStreak = 0;

    // Check backwards from today
    const checkDate = new Date();
    let tempStreak = 0;
    for (let i = 0; i < 365; i++) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (allDates.has(dateStr)) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
        if (i === 0 || currentStreak === i) {
          currentStreak = tempStreak;
        }
      } else {
        if (i > 0 && tempStreak > 0) {
          // Streak broken
          if (currentStreak < tempStreak && currentStreak === i) {
            // This handles when today has no completions but yesterday did
          }
        }
        tempStreak = 0;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Simpler streak calculation
    let streak = 0;
    const streakDate = new Date();
    // If today has no completions, start from yesterday
    const streakTodayStr = `${streakDate.getFullYear()}-${String(streakDate.getMonth() + 1).padStart(2, '0')}-${String(streakDate.getDate()).padStart(2, '0')}`;
    if (!allDates.has(streakTodayStr)) {
      streakDate.setDate(streakDate.getDate() - 1);
    }
    while (true) {
      const ds = `${streakDate.getFullYear()}-${String(streakDate.getMonth() + 1).padStart(2, '0')}-${String(streakDate.getDate()).padStart(2, '0')}`;
      if (!allDates.has(ds)) break;
      streak++;
      streakDate.setDate(streakDate.getDate() - 1);
    }

    // Calculate longest streak properly
    let longest = 0;
    let current = 0;
    const sortedDates = Array.from(allDates).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        current = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          current++;
        } else {
          current = 1;
        }
      }
      longest = Math.max(longest, current);
    }

    const stats: TodoStats = {
      totalOpen: openCount,
      totalCompleted: completedCount,
      completedToday,
      completedThisWeek,
      currentStreak: streak,
      longestStreak: longest,
      completionsByDay,
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching todo stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/todo/stats/calendar?month=YYYY-MM — calendar data for a month
router.get('/calendar', (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month query param (YYYY-MM) is required' });
      return;
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Fetch groups for color/name lookup
    const groups = db.select().from(todoGroups).all();
    const groupMap = new Map(groups.map(g => [g.id, g]));

    // Non-recurring todos with due dates in this month
    const directTodos = db
      .select()
      .from(todos)
      .where(and(
        gte(todos.dueDate, startDate),
        lte(todos.dueDate, endDate),
        sql`parent_id IS NULL`
      ))
      .all();

    const calendarTodos: CalendarTodo[] = directTodos.map(t => {
      const group = groupMap.get(t.groupId);
      return {
        id: t.id,
        title: t.title,
        priority: t.priority as CalendarTodo['priority'],
        status: t.status as CalendarTodo['status'],
        dueDate: t.dueDate!,
        groupColor: group?.color || '#6366f1',
        groupName: group?.name || 'Unknown',
        isRecurring: !!t.recurrence,
        isRecurringInstance: false,
      };
    });

    // Expand recurring todos into instances for this month
    const recurringTodos = db
      .select()
      .from(todos)
      .where(and(
        sql`recurrence IS NOT NULL`,
        eq(todos.status, 'open'),
        sql`parent_id IS NULL`
      ))
      .all();

    // Get recurring completions for this month
    const completions = db
      .select()
      .from(recurringCompletions)
      .where(and(
        gte(recurringCompletions.completionDate, startDate),
        lte(recurringCompletions.completionDate, endDate)
      ))
      .all();

    const completionSet = new Set(
      completions.map(c => `${c.todoId}_${c.completionDate}`)
    );

    for (const t of recurringTodos) {
      const recurrence = parseRecurrence(t.recurrence);
      if (!recurrence) continue;
      const group = groupMap.get(t.groupId);

      const instances = expandRecurrence(recurrence, startDate, endDate, t.dueDate || t.createdAt.split('T')[0]);
      for (const date of instances) {
        // Skip if already in directTodos (same date as due_date)
        if (t.dueDate === date) continue;

        const isCompleted = completionSet.has(`${t.id}_${date}`);
        calendarTodos.push({
          id: `${t.id}_${date}`,
          title: t.title,
          priority: t.priority as CalendarTodo['priority'],
          status: isCompleted ? 'completed' : 'open',
          dueDate: date,
          groupColor: group?.color || '#6366f1',
          groupName: group?.name || 'Unknown',
          isRecurring: true,
          isRecurringInstance: true,
        });
      }
    }

    // Sort by date then priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    calendarTodos.sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });

    res.json(calendarTodos);
  } catch (err) {
    console.error('Error fetching calendar data:', err);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

function expandRecurrence(rule: RecurrenceRule, rangeStart: string, rangeEnd: string, todoStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(todoStart + 'T00:00:00');
  const end = new Date(rangeEnd + 'T23:59:59');
  const rStart = new Date(rangeStart + 'T00:00:00');
  const endDate = rule.endDate ? new Date(rule.endDate + 'T23:59:59') : null;
  const exceptionSet = new Set(rule.exceptions || []);

  const current = new Date(start);
  const maxIterations = 1000;
  let iterations = 0;

  while (current <= end && iterations < maxIterations) {
    iterations++;

    if (endDate && current > endDate) break;

    const dateStr = current.toISOString().split('T')[0];

    if (current >= rStart && !exceptionSet.has(dateStr)) {
      if (rule.frequency === 'weekly' && rule.weekdays && rule.weekdays.length > 0) {
        if (rule.weekdays.includes(current.getDay())) {
          dates.push(dateStr);
        }
      } else {
        dates.push(dateStr);
      }
    }

    // Advance to next occurrence
    switch (rule.frequency) {
      case 'daily':
        current.setDate(current.getDate() + rule.interval);
        break;
      case 'weekly':
        if (rule.weekdays && rule.weekdays.length > 0) {
          current.setDate(current.getDate() + 1); // step day by day for weekday matching
        } else {
          current.setDate(current.getDate() + 7 * rule.interval);
        }
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + rule.interval);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + rule.interval);
        break;
    }
  }

  return dates;
}

export default router;
