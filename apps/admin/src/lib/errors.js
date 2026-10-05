import { ApiError } from '@noor/contract'

const messages = /** @type {Record<string, string>} */ ({
  invalid_credentials: 'The email or password is not right.',
  invalid_code: 'That code is not right. Check the app and try again.',
  token_expired: 'This link has expired or was already used. Ask for a new one.',
  forbidden: 'You do not have permission to do that.',
  step_up_required: 'Confirm your password to continue.',
  stale_write: 'Someone else changed this. Reload and try again.',
  unavailable: 'The server is not reachable. Try again in a moment.',
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

/** @param {unknown} reason */
function passwordReason(reason) {
  return typeof reason === 'string' && reason ? `That password is not strong enough: ${reason.replace(/_/g, ' ')}.` : 'That password is not strong enough.'
}
