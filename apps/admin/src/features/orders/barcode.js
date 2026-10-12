// Code 128, subset B (printable ASCII), as bars: the order number on the invoice for a scanner at the packing table (plan/07-admin/05-orders.md section 5.2). No library: about thirty lines and a table.
// Each symbol is six widths (bar, space, bar, space, bar, space) adding up to 11 modules; the stop symbol has a seventh (a bar) and 13 modules.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104
const STOP = 106

export const patterns = PATTERNS

/**
 * The symbol values of a text: start B, one value per character, the check symbol, stop. Only printable ASCII can be encoded.
 * @param {string} text
 */
export function code128Values(text) {
  /** @type {number[]} */
  const values = []
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) throw new Error(`cannot encode "${ch}" in Code 128 B`)
    values.push(code - 32)
  }
  const check = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103
  return [START_B, ...values, check, STOP]
}

/**
 * The bars of a text as `{ x, width }` in modules, and the width of the whole code in modules (the quiet zone is not included).
 * @param {string} text
 * @returns {{ bars: { x: number; width: number }[]; width: number }}
 */
export function code128(text) {
  /** @type {{ x: number; width: number }[]} */
  const bars = []
  let x = 0
  for (const value of code128Values(text)) {
    const widths = /** @type {string} */ (PATTERNS[value]).split('').map(Number)
    widths.forEach((w, i) => {
      if (i % 2 === 0) bars.push({ x, width: w })
      x += w
    })
  }
  return { bars, width: x }
}
