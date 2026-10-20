// Doing one thing to many items (plan/10-api/00-conventions.md section 10): each item goes through the same function a single request would use, in its own transaction,
// so one that cannot be done (still in use, already gone) never stops or undoes the others, and the answer names every item and the reason.
import { DomainError } from './errors.js'

/** What the keys of an `in_use` error count, in words (the admin's single delete says the same). */
const nouns = /** @type {Record<string, [string, string]>} */ ({
  children: ['child category', 'child categories'],
  products: ['product', 'products'],
  categories: ['category', 'categories'],
  options: ['product option', 'product options'],
  orders: ['order', 'orders'],
})

/** "It is used by 2 products and 1 child category, so it cannot be deleted." from the details of an `in_use` error. @param {Record<string, unknown>} details */
function usedBy(details) {
  const by = /** @type {Record<string, number> | undefined} */ (details.usedBy)
  const parts = Object.entries(by ?? {}).filter(([, n]) => n > 0).map(([what, n]) => `${n} ${(nouns[what] ?? [what, what])[n === 1 ? 0 : 1]}`)
  return parts.length ? `It is used by ${parts.join(' and ')}, so it cannot be deleted.` : undefined
}

/**
 * @param {string[]} ids
 * @param {(id: string) => Promise<unknown>} one the single-item function; throws a DomainError when the item cannot be done
 * @returns {Promise<import('@noor/contract').BulkResult>}
 */
export async function eachOf(ids, one) {
  /** @type {string[]} */
  const succeeded = []
  /** @type {{ id: string, code: string, detail?: string }[]} */
  const failed = []
  for (const id of new Set(ids)) {
    try {
      await one(id)
      succeeded.push(id)
    } catch (e) {
      if (!(e instanceof DomainError)) throw e // a real fault is a fault: it must not look like "could not be deleted"
      const detail = e.code === 'in_use' ? usedBy(e.details) : undefined
      failed.push({ id, code: e.code, ...(detail ? { detail } : {}) })
    }
  }
  return { succeeded, failed }
}
