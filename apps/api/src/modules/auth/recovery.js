// Recovery codes for two-factor (plan/11-security-auth.md section 3.3): 10 codes of 10 characters from an alphabet without look-alikes,
// stored as Argon2id hashes, each usable once. Shown to the person exactly once.
import { randomInt } from 'node:crypto'
import { hashPassword, verifyPassword } from './password.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1
export const CODE_COUNT = 10
export const CODE_LENGTH = 10

export const newRecoveryCode = () => Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

/** What a person types may have spaces, dashes or lower case. @param {string} input */
export const normalizeRecoveryCode = (input) => input.replace(/[\s-]/g, '').toUpperCase()

/** Shown as "ABCDE-FGHJK". @param {string} code */
export const formatRecoveryCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`

/** Makes a fresh set: the plain codes (to show once) and their hashes (to store). */
export async function createRecoveryCodes() {
  const codes = Array.from({ length: CODE_COUNT }, newRecoveryCode)
  const hashes = await Promise.all(codes.map((c) => hashPassword(c)))
  return { codes: codes.map(formatRecoveryCode), hashes }
}

/**
 * Index of the stored hash that matches the typed code, or -1.
 * @param {string} input
 * @param {string[]} hashes
 */
export async function matchRecoveryCode(input, hashes) {
  const code = normalizeRecoveryCode(input)
  if (code.length !== CODE_LENGTH) return -1
  for (let i = 0; i < hashes.length; i++) if (await verifyPassword(/** @type {string} */ (hashes[i]), code)) return i
  return -1
}
