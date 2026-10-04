// Random tokens and their stored hashes. Anything that works as a credential (session id, invite/reset token, CSRF token) is random
// and only its SHA-256 is stored, so a leaked database yields nothing usable (plan/09-data-model/02-auth-audit.md section 3).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** 32 random bytes as base64url (43 characters). */
export const randomToken = () => randomBytes(32).toString('base64url')

/** @param {string} value */
export const sha256Hex = (value) => createHash('sha256').update(value).digest('hex')

/** Constant-time comparison of two strings. @param {string} a @param {string} b */
export function safeEqual(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
