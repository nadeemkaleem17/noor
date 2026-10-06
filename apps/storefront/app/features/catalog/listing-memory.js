// What a listing remembers for the Back button (plan/06-storefront/03-plp-search.md section 6): how many more pages were loaded and how far the visitor had scrolled.
// Kept per listing address in sessionStorage; the products themselves are fetched again. Storage may be blocked or full: then nothing is restored, nothing breaks.

const KEY = 'listing:'

/** @param {string} key @returns {{ n?: number, y?: number }} */
const read = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY + key) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/** @param {string} key @returns {{ n: number, y: number }} n = pages loaded after the first */
export function recall(key) {
  const { n, y } = read(key)
  return { n: Math.max(0, Math.min(Number(n) || 0, 9)), y: Math.max(0, Number(y) || 0) }
}

/** @param {string} key @param {{ n?: number, y?: number }} patch */
export function remember(key, patch) {
  try {
    sessionStorage.setItem(KEY + key, JSON.stringify({ ...read(key), ...patch }))
  } catch {
    // blocked or full
  }
}
