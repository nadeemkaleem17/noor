// The words of the review screens (plan/07-admin/08-reviews.md).
export const rejectReasons = /** @type {const} */ ([
  ['offensive', 'Offensive'],
  ['personal_data', 'Personal data (a phone number or an address)'],
  ['not_about_product', 'Not about the product'],
  ['spam', 'Spam'],
  ['other', 'Other'],
])
export const fitLabels = /** @type {Record<string, string>} */ ({ runs_small: 'Runs small', true_to_size: 'True to size', runs_large: 'Runs large' })
/** @param {string | undefined} code */
export const reasonLabel = (code) => rejectReasons.find(([c]) => c === code)?.[1] ?? code ?? ''
/** @param {number} n the stars, as text for a screen reader and the eye */
export const starsText = (n) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`
