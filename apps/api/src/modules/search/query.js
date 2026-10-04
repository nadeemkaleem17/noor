// Turning what a customer typed into a safe boolean-mode expression (plan/09-data-model/05-search.md section 3). Pure functions.

export const MAX_QUERY_CHARS = 80
export const MAX_WORDS = 8

/**
 * Lower-case, only letters, digits and spaces (hyphens read as spaces, as the index reads them), single spaces, at most 80 characters and 8 words.
 * Every operator of boolean mode (plus, minus, star, quotes, brackets, tilde, angle brackets, at) is gone after this.
 * @param {string} raw
 */
export function normalise(raw) {
  const cleaned = raw.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS)
  return cleaned.split(' ').filter(Boolean).slice(0, MAX_WORDS).join(' ')
}

/**
 * `shalwaar kam` -> `+(shalwaar shalwar) +(kam*)`: every word is required, its spellings are alternatives, and the word being typed
 * (the last one) matches as a prefix. Words of one letter are dropped: the index does not hold them. Returns '' when nothing is left.
 * @param {string} normalised output of `normalise`
 * @param {ReadonlyMap<string, string[]>} synonyms term -> the other spellings
 */
export function toExpression(normalised, synonyms) {
  const words = normalised.split(' ').filter((w) => [...w].length >= 2)
  return words
    .map((word, i) => {
      const alternatives = [...new Set([word, ...(synonyms.get(word) ?? [])])]
      const last = i === words.length - 1
      return `+(${alternatives.map((a) => (last ? `${a}*` : a)).join(' ')})`
    })
    .join(' ')
}

/** Text that may be a phone number is never kept in the miss log: seven digits in a row, spaces ignored. @param {string} normalised */
export const looksLikePhone = (normalised) => /\d{7,}/.test(normalised.replace(/\s/g, ''))
