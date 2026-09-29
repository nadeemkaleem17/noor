import { useEffect, useRef, useState } from 'react'

// Bump SCHEMA_VERSION whenever the shape of any persisted slice changes in a way the
// per-slice validators can't detect. Old blobs are then discarded and seed data is used.
const SCHEMA_VERSION = 1
const PREFIX = 'storefront:'

function fullKey(key) {
  return PREFIX + key
}

function safeStorage() {
  try {
    return window.localStorage
  } catch {
    return null // blocked (private mode / disabled cookies)
  }
}

// Returns the parsed value if the blob is well-formed, current-version and passes
// `validate`; otherwise returns `undefined` so callers fall back to seed data.
function parseBlob(raw, validate) {
  if (raw == null) return undefined
  try {
    const blob = JSON.parse(raw)
    if (!blob || blob.v !== SCHEMA_VERSION || !('data' in blob)) return undefined
    return validate(blob.data) ? blob.data : undefined
  } catch {
    return undefined
  }
}

function readPersisted(key, validate) {
  const storage = safeStorage()
  if (!storage) return undefined
  try {
    const value = parseBlob(storage.getItem(fullKey(key)), validate)
    if (value === undefined && storage.getItem(fullKey(key)) != null) {
      storage.removeItem(fullKey(key)) // corrupt/stale — clear it so it can't fail again
    }
    return value
  } catch {
    return undefined
  }
}

/**
 * useState that survives refresh via localStorage.
 *  - `initial` is used on first visit, or whenever the stored blob is missing,
 *    corrupt, from another schema version, or fails `validate`.
 *  - Changes made in another tab are picked up via the `storage` event.
 */
export function usePersistentState(key, initial, validate = () => true) {
  const [state, setState] = useState(() => {
    const stored = readPersisted(key, validate)
    return stored === undefined ? initial : stored
  })
  const lastWritten = useRef(null)
  const validateRef = useRef(validate)

  useEffect(() => {
    const storage = safeStorage()
    if (!storage) return
    let serialized
    try {
      serialized = JSON.stringify({ v: SCHEMA_VERSION, data: state })
    } catch {
      return
    }
    if (serialized === lastWritten.current) return
    lastWritten.current = serialized
    try {
      storage.setItem(fullKey(key), serialized)
    } catch {
      // quota exceeded or storage unavailable — keep working in memory
    }
  }, [key, state])

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== fullKey(key) || e.newValue == null) return
      const value = parseBlob(e.newValue, validateRef.current)
      if (value === undefined) return
      lastWritten.current = e.newValue // don't echo it straight back
      setState(value)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [state, setState]
}

// Wipes every persisted slice and reloads, returning the app to its seed data.
export function resetPersistedData() {
  const storage = safeStorage()
  if (storage) {
    try {
      Object.keys(storage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => storage.removeItem(k))
    } catch {
      // ignore
    }
  }
  window.location.reload()
}

// ---- small validator helpers -------------------------------------------------
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
export const isArrayOf = (check) => (v) => Array.isArray(v) && v.every(check)
export const isStr = (v) => typeof v === 'string'
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
