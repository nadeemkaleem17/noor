// The part of ICU MessageFormat the shop's texts use: {name}, {n, number}, {n, plural, =0 {..} one {..} other {..}} with #, {x, select, a {..} other {..}}, and the apostrophe
// rules of ICU. It replaces `i18next-icu` with `intl-messageformat` (about 25 kB gzip in every page and in the admin) for 80 lines. Anything else (offsets, dates, tags)
// is refused the way a syntax error is: the message is shown as written. `test/icu-lite.test.js` checks it against `intl-messageformat` on every message of every catalog.

/**
 * @param {string} message
 * @param {string} locale
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function format(message, locale, values) {
  let i = 0
  const fail = () => {
    throw new Error('message not understood')
  }
  const number = (/** @type {number} */ n) => new Intl.NumberFormat(locale).format(n)

  /** Text up to the `}` that ends the option it is in (not consumed), or to the end. @param {boolean} nested @param {number | undefined} count the value `#` stands for */
  function text(nested, count) {
    let out = ''
    while (i < message.length) {
      const c = /** @type {string} */ (message[i])
      if (c === "'") {
        const next = message[i + 1]
        if (next === "'") {
          out += "'"
          i += 2
        } else if (next === '{' || next === '}' || (next === '#' && count !== undefined)) {
          // quoted text, up to the closing apostrophe
          const end = message.indexOf("'", i + 1)
          if (end < 0) fail()
          out += message.slice(i + 1, end).replaceAll("''", "'")
          i = end + 1
        } else {
          out += c
          i++
        }
      } else if (c === '{') {
        i++
        out += argument()
      } else if (c === '}') {
        if (nested) return out
        out += c // a closing brace with nothing to close is text, as in ICU
        i++
      } else if (c === '#' && count !== undefined) {
        out += number(count)
        i++
      } else {
        out += c
        i++
      }
    }
    if (nested) fail()
    return out
  }

  const skipSpaces = () => {
    while (message[i] === ' ' || message[i] === '\n' || message[i] === '\t') i++
  }
  /** A word up to one of `stops`. @param {string} stops */
  const until = (stops) => {
    const start = i
    while (i < message.length && !stops.includes(/** @type {string} */ (message[i]))) i++
    return message.slice(start, i).trim()
  }

  /** What follows `{`: the argument and its closing `}`. */
  function argument() {
    const name = until(',}')
    if (!name) fail()
    const value = values[name]
    if (message[i] === '}') {
      i++
      if (value === undefined) fail()
      return String(value)
    }
    i++ // the comma
    const kind = until(',}')
    if (kind === 'number') {
      until('}')
      i++
      if (typeof value !== 'number') fail()
      return number(/** @type {number} */ (value))
    }
    if (kind !== 'plural' && kind !== 'select') fail()
    if (message[i] !== ',') fail()
    i++
    /** @type {Map<string, string>} the text of each option, already formatted for this value */
    const options = new Map()
    const n = kind === 'plural' ? Number(value) : 0
    const chosen = kind === 'plural' ? [`=${n}`, new Intl.PluralRules(locale).select(n), 'other'] : [String(value), 'other']
    if (value === undefined || (kind === 'plural' && Number.isNaN(n))) fail()
    skipSpaces()
    while (message[i] !== '}') {
      const selector = until(' \n\t{')
      if (!selector || selector.startsWith('offset:')) fail()
      skipSpaces()
      if (message[i] !== '{') fail()
      i++
      // every option is read (so a mistake in one that is not chosen is still a mistake), only the chosen ones are kept
      const body = text(true, kind === 'plural' ? n : undefined)
      i++ // the closing brace of the option
      if (chosen.includes(selector) && !options.has(selector)) options.set(selector, body)
      skipSpaces()
    }
    i++ // the closing brace of the argument
    const pick = chosen.find((s) => options.has(s))
    if (pick === undefined) fail()
    return /** @type {string} */ (options.get(/** @type {string} */ (pick)))
  }

  return text(false, undefined)
}

/** The i18next plug-in (type `i18nFormat`) with the same contract as `i18next-icu`: a message that cannot be formatted (a variable not given, a syntax i18n-lite does not know) is returned as written. */
export class LiteICU {
  /** @type {'i18nFormat'} */
  type = 'i18nFormat'
  init() {}
  /** @param {string} res @param {Record<string, unknown>} options @param {string} lng */
  parse(res, options, lng) {
    try {
      return format(res, lng, options ?? {})
    } catch {
      return res
    }
  }
  /** @param {string[]} finalKeys no extra keys for plural or select: the message holds them */
  addLookupKeys(finalKeys) {
    return finalKeys
  }
}
