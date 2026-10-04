// Passwords (plan/11-security-auth.md section 3.1): Argon2id, 12-128 characters, no composition rules, a blocklist.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hash, verify } from '@node-rs/argon2'

// OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane. The parameters are stored in the hash string.
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1, algorithm: 2 } // algorithm 2 = Argon2id

export const MIN_LENGTH = 12
export const MAX_LENGTH = 128

/** @param {string} password */
export const hashPassword = (password) => hash(password, ARGON)

/** @param {string} stored @param {string} password */
export async function verifyPassword(stored, password) {
  try {
    return await verify(stored, password)
  } catch {
    return false // a malformed stored hash is a failed login, not a crash
  }
}

/** True when the hash was made with weaker settings than today's: rehash after a successful login. @param {string} stored */
export const needsRehash = (stored) => {
  const m = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored)
  return !m || Number(m[1]) < ARGON.memoryCost || Number(m[2]) < ARGON.timeCost
}

/** A hash of a throwaway password, verified when the email is unknown so the response takes as long as a real login. */
let dummy
export const dummyHash = () => (dummy ??= hashPassword('not-a-real-password-for-timing-only'))

/** @type {Set<string> | undefined} */
let common
const commonSet = () =>
  (common ??= new Set(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'common-passwords.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean)))

/** The letters of a password with leading and trailing digits and symbols taken off: "Sunshine2026!!" -> "sunshine". @param {string} p */
const core = (p) => p.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')

/**
 * Checks a new password. Returns the reason for the first problem (the API answers `password_too_weak` with that reason), or null.
 * @param {string} password
 * @param {{ email?: string, storeName?: string }} [context]
 * @returns {'too_short' | 'too_long' | 'common' | 'repetitive' | 'contains_name' | null}
 */
export function passwordProblem(password, { email, storeName = 'rubaya' } = {}) {
  if ([...password].length < MIN_LENGTH) return 'too_short'
  if ([...password].length > MAX_LENGTH) return 'too_long'
  const lower = password.toLowerCase()
  const set = commonSet()
  if (set.has(lower) || (core(password).length >= 4 && set.has(core(password)))) return 'common'
  if (new Set(lower).size <= 3) return 'repetitive' // "aaaaaaaaaaaa", "abababababab"
  if (/^(?:0123456789|1234567890|qwertyuiop|asdfghjkl|zxcvbnm)/.test(lower.replace(/\s/g, '')) && lower.length < 20) return 'repetitive'
  const local = email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return 'contains_name'
  if (storeName.length >= 4 && lower.includes(storeName.toLowerCase())) return 'contains_name'
  return null
}
