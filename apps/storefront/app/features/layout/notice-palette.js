/** The colour pairs a notice can have (plan/17-owner-requests-2026-10.md item 4): the shop's own tokens, so the words are readable in every theme. */
export const paletteClass = /** @type {Record<string, string>} */ ({
  accent: 'bg-accent text-on-accent',
  ink: 'bg-fg text-bg',
  sand: 'bg-surface-2 text-fg',
  success: 'bg-success-soft text-fg',
  warning: 'bg-warning-soft text-fg',
})

/**
 * Should a popup be shown to this visitor now? `every`: each visit (once per browser session), once a day, or once ever.
 * @param {'visit' | 'day' | 'once'} every @param {number | undefined} lastShownAt @param {boolean} seenThisSession @param {number} now
 */
export function popupDue(every, lastShownAt, seenThisSession, now) {
  if (every === 'visit') return !seenThisSession
  if (lastShownAt === undefined) return true
  return every === 'day' && now - lastShownAt > 24 * 60 * 60 * 1000
}
