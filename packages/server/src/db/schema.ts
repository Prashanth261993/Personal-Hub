import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
