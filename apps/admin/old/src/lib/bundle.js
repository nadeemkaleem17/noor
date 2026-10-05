// JSON bundle: one file holding everything the storefront (or another admin) needs.
import { COLLECTION_NAMES, SINGLETON_NAMES } from './db.js'

export const BUNDLE_FORMAT = 'noor-admin-bundle'
export const BUNDLE_VERSION = 1

export function buildBundle(data, now = new Date()) {
  return { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now.toISOString(), ...data }
}

// -> { ok: true, bundle, summary: [{ name, count }] } | { ok: false, error }
export function parseBundle(text) {
  let raw
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'That file is not valid JSON.' } }
  if (!raw || raw.format !== BUNDLE_FORMAT) return { ok: false, error: 'This is not an admin bundle (missing format marker).' }
  if (raw.version !== BUNDLE_VERSION) return { ok: false, error: `Bundle version ${raw.version} is not supported (expected ${BUNDLE_VERSION}).` }
  if (typeof raw.collections !== 'object' || raw.collections === null) return { ok: false, error: 'Bundle has no collections.' }
  for (const [k, v] of Object.entries(raw.collections)) {
    if (COLLECTION_NAMES.includes(k) && !Array.isArray(v)) return { ok: false, error: `“${k}” must be a list.` }
  }
  const summary = [
    ...COLLECTION_NAMES.filter((k) => Array.isArray(raw.collections[k])).map((k) => ({ name: k, count: raw.collections[k].length })),
    ...SINGLETON_NAMES.filter((k) => raw.singletons?.[k]).map((k) => ({ name: k, count: 1 })),
  ]
  if (!summary.length) return { ok: false, error: 'Bundle contains none of the collections this admin manages.' }
  return { ok: true, bundle: { collections: raw.collections, singletons: raw.singletons || {} }, summary }
}
