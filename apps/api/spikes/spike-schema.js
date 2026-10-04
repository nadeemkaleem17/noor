// Tables used only by the M0-06 and M0-07 spikes (never migrated into the real database).
import { check, datetime, int, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

export const spikeItems = mysqlTable(
  'spike_items',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 40 }).notNull(),
    qty: int('qty').notNull(),
    data: json('data'),
    at: datetime('at', { fsp: 3 }),
  },
  (t) => [check('spike_items_qty_nonneg', sql`${t.qty} >= 0`)],
)

/** One row per job that ran. The primary key makes a second run of the same job fail loudly. */
export const spikeRuns = mysqlTable('spike_runs', {
  jobId: varchar('job_id', { length: 36 }).primaryKey(),
  worker: varchar('worker', { length: 64 }).notNull(),
})
