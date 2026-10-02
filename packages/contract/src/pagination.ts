// List shapes and query-string helpers (plan/10-api/00-conventions.md sections 4 and 7).
// Query schemas accept both the wire form (strings) and the native form (numbers, arrays, booleans),
// so the typed client can validate the same value the server later parses from the URL.
import { z } from 'zod'

/** Integer from "12" or 12. */
export const qint = <T extends z.ZodType>(inner: T) =>
  z.preprocess((v) => (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v), inner)

/** Comma-separated list from "a,b" or ["a","b"]. */
export const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? (v === '' ? [] : v.split(',')) : v), z.array(item))

/** Boolean from "1"/"0" or true/false. */
export const flag = z.preprocess((v) => (v === '1' || v === true ? true : v === '0' || v === false ? false : v), z.boolean())

/** Admin list query: page numbers, a page size, optional sort and search (DOC-10.0 section 7.2). */
export const PageQuery = z.strictObject({
  page: qint(z.number().int().min(1)).default(1),
  size: qint(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(50),
  sort: z.string().regex(/^-?[A-Za-z]+$/).optional(),
  q: z.string().trim().min(2).max(80).optional(),
})

/** Public list query: opaque cursor and a limit (DOC-10.0 section 7.1). `max` is the endpoint's cap. */
export const cursorQuery = (max: number, fallback = 24) =>
  z.strictObject({
    limit: qint(z.number().int().min(1).max(max)).default(fallback),
    cursor: z.string().max(500).optional(),
  })

export const Page = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    size: z.number().int().min(1),
  })

export const CursorPage = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    nextCursor: z.string().optional(),
    total: z.number().int().nonnegative().optional(),
  })

/** Result of a bulk action (DOC-10.0 section 10). */
export const BulkResult = z.strictObject({
  succeeded: z.array(z.string()),
  failed: z.array(z.strictObject({ id: z.string(), code: z.string(), detail: z.string().optional() })),
})
export type BulkResult = z.infer<typeof BulkResult>
