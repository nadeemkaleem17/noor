export function makeId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Live-typing version: same rules, but keeps a trailing hyphen so the user can
// keep typing "red-" -> "red-shirt". Strict slugify() runs on blur / save.
export function slugifyLoose(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
}

export function randomSuffix(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len)
}