import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),            // YYYY-MM-DD
  note: text('note'),
  createdAt: text('created_at').notNull(),  // ISO datetime
});

export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull(),
  categoryId: text('category_id').notNull(),
  type: text('type', { enum: ['asset', 'liability'] }).notNull(),
  name: text('name').notNull(),
  value: integer('value').notNull(), // cents; positive for assets, negative for liabilities
});

// ── Todo App Tables ──

export const todoGroups = sqliteTable('todo_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => todoGroups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
  status: text('status', { enum: ['open', 'completed'] }).notNull().default('open'),
  dueDate: text('due_date'),
  recurrence: text('recurrence'),          // JSON-stringified RecurrenceRule
  parentId: text('parent_id'),             // self-referencing FK for subtasks
  sortOrder: integer('sort_order').notNull().default(0),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const recurringCompletions = sqliteTable('recurring_completions', {
  id: text('id').primaryKey(),
  todoId: text('todo_id')
    .notNull()
    .references(() => todos.id, { onDelete: 'cascade' }),
  completionDate: text('completion_date').notNull(),
  completedAt: text('completed_at').notNull(),
}, (table) => ([
  uniqueIndex('idx_recurring_todo_date').on(table.todoId, table.completionDate),
]));
