// Contract validation for admin collections (F-03).
//
// validateItem(collection, item) -> { success: true } | { success: false, errors: [{ path, message }] }
//
// Two layers:
//   1. A few admin-only rules with friendlier messages (handle format, lead times, SEO length).
//   2. The Zod schema from contract/schemas.js, the single source of truth shared with the storefront.
//
// Products that are still 'draft' or 'archived' are allowed to be incomplete (no media yet, no variants
// priced yet...), so for those only the light rules in layer 1 run. Anything 'active' or 'scheduled'
// must satisfy the full contract, because that is what the storefront will read.

import { collections, StoreConfig } from '../contract/schemas.js'

const PRODUCT_STATUSES = ['draft', 'scheduled', 'active', 'archived']
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isBlank = (v) => typeof v !== 'string' || v.trim() === ''

function productRules(p) {
  const errors = []
  const err = (path, message) => errors.push({ path, message })

  if (isBlank(p.title)) err('title', 'Title is required')

  if (isBlank(p.handle)) err('handle', 'Handle is required')
  else if (!HANDLE_RE.test(p.handle)) err('handle', 'Use lowercase letters, numbers and single hyphens only')

  if (!PRODUCT_STATUSES.includes(p.status)) err('status', `Must be one of: ${PRODUCT_STATUSES.join(', ')}`)
  if (p.status === 'scheduled' && isBlank(p.publishedAt)) err('publishedAt', 'Pick a publish date for a scheduled product')
  if (Array.isArray(p.highlights) && p.highlights.length > 6) err('highlights', 'At most 6 highlights')
  if (isBlank(p.primaryCategoryId)) err('primaryCategoryId', 'Pick a primary category')

  if (p.kind === 'made-to-order' && p.madeToOrder) {
    const { leadTime, depositPercent } = p.madeToOrder
    const min = leadTime?.minDays ?? 0
    const max = leadTime?.maxDays ?? 0
    if (min < 0) err('madeToOrder.leadTime.minDays', 'Cannot be negative')
    if (max < min) err('madeToOrder.leadTime.maxDays', 'Must be greater than or equal to min days')
    if (depositPercent !== undefined && (depositPercent < 0 || depositPercent > 100)) {
      err('madeToOrder.depositPercent', 'Must be between 0 and 100')
    }
  }

  if (p.seo?.title && p.seo.title.length > 70) err('seo.title', 'Keep under 70 characters')
  if (p.seo?.description && p.seo.description.length > 320) err('seo.description', 'Keep under 320 characters')

  return errors
}

const RULES = { products: productRules }

// Drafts and archived products may be incomplete; everything else is held to the full contract.
function needsFullContract(collection, item) {
  if (collection !== 'products') return true
  return item?.status !== 'draft' && item?.status !== 'archived'
}

export function validateItem(collection, item) {
  const errors = []

  const rules = RULES[collection]
  if (rules) errors.push(...rules(item || {}))

  const schema = collections[collection]
  if (schema && needsFullContract(collection, item)) {
    const result = schema.safeParse(item)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ path: issue.path.join('.') || '(item)', message: issue.message })
      }
    }
  }

  // The same field can be flagged by both layers; show each path once (the friendlier message wins).
  const seen = new Set()
  const unique = errors.filter((e) => (seen.has(e.path) ? false : seen.add(e.path)))

  return unique.length ? { success: false, errors: unique } : { success: true }
}

// Turns [{ path, message }, ...] into readable text for console warnings.
export function formatValidationErrors(errors = []) {
  return errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')
}

// Thrown by the data layer (lib/db.js) when a write would put a record that breaks the contract into storage.
// `failures` is [{ id, errors: [{ path, message }] }], one entry per rejected record.
export class ContractError extends Error {
  constructor(collection, failures) {
    super(`Contract violation in ${collection}: ${summarizeFailures(failures)}`)
    this.name = 'ContractError'
    this.collection = collection
    this.failures = failures
  }
}

// Short, human-readable one-liner: "Title is required (+2 more)". Used in toasts and error messages.
export function summarizeErrors(errors = []) {
  if (!errors.length) return 'Unknown validation error'
  const [first, ...rest] = errors
  const head = first.path && first.path !== '(item)' ? `${first.path}: ${first.message}` : first.message
  return rest.length ? `${head} (+${rest.length} more)` : head
}

export function summarizeFailures(failures = []) {
  const [first, ...rest] = failures
  if (!first) return 'no details'
  const head = `${first.id} — ${summarizeErrors(first.errors)}`
  return rest.length ? `${head} (+${rest.length} more record${rest.length === 1 ? '' : 's'})` : head
}

// Same shape as validateItem, for singletons (only storeConfig today).
const SINGLETON_SCHEMAS = { storeConfig: StoreConfig }
export function validateSingleton(name, value) {
  const schema = SINGLETON_SCHEMAS[name]
  if (!schema) return { success: true }
  const result = schema.safeParse(value)
  if (result.success) return { success: true }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({ path: issue.path.join('.') || '(item)', message: issue.message })),
  }
}
