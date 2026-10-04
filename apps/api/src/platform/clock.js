// One source of "now" so tests can control time (DOC-08 section 7). Services call now(); nothing calls `new Date()` for business time.
/** @type {Date | null} */
let fixed = null

/** The current instant. */
export const now = () => (fixed ? new Date(fixed.getTime()) : new Date())

/**
 * Freezes the clock (tests). Pass a Date, or call `setClock(null)` to run in real time again.
 * @param {Date | null} date
 */
export const setClock = (date) => {
  fixed = date
}

/**
 * Moves a frozen clock forward.
 * @param {number} ms
 */
export const advanceClock = (ms) => {
  if (!fixed) throw new Error('the clock is not frozen')
  fixed = new Date(fixed.getTime() + ms)
}
