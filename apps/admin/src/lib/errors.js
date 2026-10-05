import { ApiError } from '@noor/contract'

const messages = /** @type {Record<string, string>} */ ({
  invalid_credentials: 'The email or password is not right.',
  invalid_code: 'That code is not right. Check the app and try again.',
  token_expired: 'This link has expired or was already used. Ask for a new one.',
  forbidden: 'You do not have permission to do that.',
  step_up_required: 'Confirm your password to continue.',
  stale_write: 'Someone else changed this. Reload and try again.',
  unavailable: 'The server is not reachable. Try again in a moment.',
  publish_checks_failed: 'This product is not ready to publish. The checks beside the form say what is missing.',
  in_use: 'This is used elsewhere, so it cannot be removed.',
  csrf_failed: 'Your session needs a refresh. Reload the page.',
})

/**
 * What to tell a person about a failed call (staff UI is English only, ADR-0018).
 * @param {unknown} error
 */
export function messageFor(error) {
  if (!(error instanceof ApiError)) return 'Could not reach the server. Check your connection and try again.'
  if (error.code === 'too_many_attempts' || error.code === 'rate_limited') {
    const seconds = Number(error.details.retryAfter)
    const minutes = Math.max(1, Math.ceil(seconds / 60))
    return Number.isFinite(seconds) ? `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` : 'Too many attempts. Try again later.'
  }
  if (error.code === 'password_too_weak') return passwordReason(error.details.reason)
  return messages[error.code] ?? 'Something went wrong. Please try again.'
}

const nouns = /** @type {Record<string, [string, string]>} */ ({
  children: ['child category', 'child categories'],
  products: ['product', 'products'],
  categories: ['category', 'categories'],
  options: ['product option', 'product options'],
})

/**
 * Why something cannot be deleted, from the server's `in_use` details: "It is used by 3 products and 2 categories, so it cannot be deleted." Falls back to the plain message.
 * @param {unknown} error
 */
export function inUseText(error) {
  if (!(error instanceof ApiError) || error.code !== 'in_use') return messageFor(error)
  const used = /** @type {Record<string, number> | undefined} */ (error.details.usedBy)
  const parts = Object.entries(used ?? {})
    .filter(([, n]) => n > 0)
    .map(([what, n]) => `${n} ${(nouns[what] ?? [what, what])[n === 1 ? 0 : 1]}`)
  return parts.length ? `It is used by ${parts.join(' and ')}, so it cannot be deleted.` : 'It is used elsewhere, so it cannot be deleted.'
}

/** @param {unknown} reason */
function passwordReason(reason) {
  return typeof reason === 'string' && reason ? `That password is not strong enough: ${reason.replace(/_/g, ' ')}.` : 'That password is not strong enough.'
}
