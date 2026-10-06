// The words of every message (plan/12-integrations.md section 4.4). The text lives in `@noor/i18n` (`notifications` namespace, one text per locale, English when a
// locale has none); this file only renders it. The same wording and variables serve every channel.
import { createI18n } from '@noor/i18n'

/** @type {Map<string, ReturnType<typeof createI18n>>} */
const instances = new Map()

/**
 * @param {'en' | 'ur'} locale @param {string} id e.g. `order.placed` @param {Record<string, string>} vars
 * @returns {string}
 */
export function render(locale, id, vars) {
  let i18n = instances.get(locale)
  if (!i18n) instances.set(locale, (i18n = createI18n(locale)))
  const key = `notifications:${id}`
  if (!i18n.exists(key)) throw new Error(`no notification text for ${id}`)
  return i18n.t(key, vars)
}

const escapeHtml = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The email's second version, from the same text: no images, the link made clickable. @param {string} text */
export const htmlOf = (text) => `<p>${escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</p>`
