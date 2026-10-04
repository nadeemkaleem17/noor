// Column helpers for the conventions of plan/09-data-model/00-conventions.md.
import { customType, datetime } from 'drizzle-orm/mysql-core'

/**
 * Exact-match text for ids, codes and keys: `varchar(n)` in `ascii_bin`, so comparisons are byte-exact and indexes small.
 * Drizzle 0.45 has no per-column collation option, hence a custom type (spike M0-06, DOC-08 section 18 Q-08-1).
 */
export const binVarchar = /** @type {typeof customType<{ data: string; config: { length: number }; configRequired: false }>} */ (customType)({
  dataType: (config) => `varchar(${config?.length ?? 190}) character set ascii collate ascii_bin`,
})

/** UUID text id, `char(36)` in `ascii_bin`. */
export const uuid = /** @type {typeof customType<{ data: string }>} */ (customType)({ dataType: () => 'char(36) character set ascii collate ascii_bin' })

/** UTC `datetime(3)`; set by the application clock, never by a database default (DOC-09.0 section 2). */
export const utc = (/** @type {string} */ name) => datetime(name, { fsp: 3 })
