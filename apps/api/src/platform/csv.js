// CSV the way a spreadsheet wants it (plan/07-admin/14-tables-bulk.md section 6): UTF-8 with a byte order mark, money as rupees with two decimals in
// their own numeric columns, and no cell that a spreadsheet would run as a formula.

/** A number as it is written in the file: not quoted, not guarded. */
class Raw {
  /** @param {string} text */
  constructor(text) {
    this.text = text
  }
}

/** Paisa as `2250.00`, in a numeric column. @param {number} paisa */
export const rupees = (paisa) => new Raw(`${paisa < 0 ? '-' : ''}${Math.trunc(Math.abs(paisa) / 100)}.${String(Math.abs(paisa) % 100).padStart(2, '0')}`)
/** A whole number in a numeric column. @param {number} n */
export const count = (n) => new Raw(String(n))

/** @param {string | Raw | null | undefined} v */
function cell(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Raw) return v.text
  // a cell that starts like a formula is made text: `=HYPERLINK(...)` must open as itself
  const text = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * @param {string[]} header
 * @param {(string | Raw | null | undefined)[][]} rows
 */
export const toCsv = (header, rows) => `${String.fromCharCode(0xfeff)}${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
