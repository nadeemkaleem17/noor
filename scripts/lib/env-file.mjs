// Pure helpers for scripts/setup-env.mjs (tested in packages/config/test/env-file.test.js).
import { randomBytes } from 'node:crypto'

const TOKEN = /__([A-Z0-9_]+)__/g

/** A fresh secret for a token name. Encryption and tracking keys are 32 random bytes in base64; the rest are hex. */
export function generateSecret(name, random = randomBytes) {
  return /ENCRYPTION|TRACKING/.test(name) ? random(32).toString('base64') : random(24).toString('hex')
}

/**
 * Replaces every `__NAME__` token with a secret, creating missing ones. `secrets` is the cache of earlier runs, so the
 * same database password reaches every file and a rerun never changes a password that is already in use.
 * @returns {{ text: string, secrets: Record<string, string> }}
 */
export function fillTokens(text, secrets, random = randomBytes) {
  const next = { ...secrets }
  const out = text.replace(TOKEN, (_, name) => (next[name] ??= generateSecret(name, random)))
  return { text: out, secrets: next }
}

/** Names of the tokens in a text, for reporting. */
export const tokensIn = (text) => [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]))]
