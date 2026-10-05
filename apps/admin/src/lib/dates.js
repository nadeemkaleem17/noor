// Staff see and enter times in Pakistan time (UTC+5, no daylight saving), whatever the browser's zone is.
const OFFSET_MS = 5 * 3_600_000

/** An ISO instant as the value of a `datetime-local` input ("2026-10-05T14:30"), in Pakistan time. @param {string | undefined} iso */
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16) : '')

/** The reverse: what a `datetime-local` input holds, read as Pakistan time, as an ISO instant. @param {string} local */
export const fromLocalInput = (local) => (local ? new Date(new Date(`${local}:00Z`).getTime() - OFFSET_MS).toISOString() : undefined)
