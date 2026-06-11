import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/index.js';
import { funds } from '../../../db/schema.js';
import { getFundSeed } from '../../../lib/config.js';
import { padCik } from './secEdgar.js';

/** Insert any seed funds that are not already tracked. Idempotent; runs on startup. */
export function seedFunds(): void {
  try {
    const { funds: seedEntries } = getFundSeed();
    const now = new Date().toISOString();

    for (const entry of seedEntries) {
      const cik = padCik(entry.cik);
      const existing = db.select().from(funds).where(eq(funds.cik, cik)).get();
      if (existing) continue;

      db.insert(funds).values({
        id: uuidv4(),
        cik,
        name: entry.name,
        status: 'active',
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  } catch (err) {
    console.error('Error seeding funds:', err);
  }
}
