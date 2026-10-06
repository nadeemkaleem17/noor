// How fast the storefront feels to the people who use it (plan/13-quality.md section 8.6): one counter per day, page, metric and size bucket, so nothing about a person is kept.
import { date, int, mysqlTable, primaryKey, smallint } from 'drizzle-orm/mysql-core'
import { binVarchar } from '../types.js'

export const webVitalsDaily = mysqlTable(
  'web_vitals_daily',
  {
    /** A day in Pakistan. */
    day: date('day', { mode: 'string' }).notNull(),
    /** `home`, `category`, `product`, `cart`, `checkout`, `order`, `page` or `other`. */
    route: binVarchar('route', { length: 40 }).notNull(),
    metric: binVarchar('metric', { length: 4 }).notNull(),
    /** LCP and INP: 100 ms steps up to 10 s. CLS: steps of 0.01 up to 1. */
    bucket: smallint('bucket').notNull(),
    count: int('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.route, t.metric, t.bucket] })],
)
