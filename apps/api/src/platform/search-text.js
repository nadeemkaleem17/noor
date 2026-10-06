// What a person types into a search box, as patterns an index can answer: a prefix (`Sana%`) and a phone number's start (`+92300123%`). A pattern that begins with `%` would
// read the whole table, so none is made here (plan/10-api/08-admin-dashboard-ops.md section 7). `%` and `_` typed by a person are text, not wildcards.

/** @param {string} text */
export const likePrefix = (text) => `${text.replace(/[\\%_]/g, '\\$&')}%`

/**
 * The start of a Pakistani mobile number as it is stored (`+923001234567`), from the digits typed: `0300 123`, `300123`, `+92 300 123` and `0092300123` all give `+92300123%`.
 * Under four digits it is nothing (too many numbers match to help anybody).
 * @param {string} text
 * @returns {string | undefined}
 */
export function phonePrefix(text) {
  const digits = text.replace(/\D/g, '')
  const national = digits.replace(/^(0092|92|0)/, '')
  return digits.length >= 4 && national ? `+92${national}%` : undefined
}
