// The list a person came from: the ids of its rows in order, so `]` and `Shift ]` on an order go to the next and the previous one (plan/07-admin/15-shortcuts.md section 4).
// A list writes it when its rows arrive; a detail screen reads it. It lives in memory: a reload forgets it, and then the keys do nothing.

/** @type {{ table: string; ids: string[]; href: string } | null} */
let current = null

/** @param {string} table @param {string[]} ids @param {string} href the address of the list, with its filters */
export const setListContext = (table, ids, href) => {
  current = { table, ids, href }
}

/** The row after or before `id` in the list it was opened from, or nothing. @param {string} table @param {string[]} candidates the ids the screen is known by @param {1 | -1} step */
export function neighbour(table, candidates, step) {
  if (!current || current.table !== table) return undefined
  const at = current.ids.findIndex((x) => candidates.includes(x))
  return at < 0 ? undefined : current.ids[at + step]
}
