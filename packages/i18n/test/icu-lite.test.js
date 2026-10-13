// The small ICU formatter (src/icu-lite.js) against the real one (`intl-messageformat`): the same output for every message of every catalog, in both languages, for
// the values a page could give it, and the same refusal (the message as written) for what it does not understand.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { IntlMessageFormat } from 'intl-messageformat'
import { describe, expect, it } from 'vitest'
import { format, LiteICU } from '../src/icu-lite.js'

const root = path.resolve(import.meta.dirname, '../locales')

/** Every string of every catalog, with where it is from. @returns {{ where: string, locale: string, message: string }[]} */
function messages() {
  /** @type {{ where: string, locale: string, message: string }[]} */
  const out = []
  /** @param {unknown} node @param {string} where @param {string} locale */
  const walk = (node, where, locale) => {
    if (typeof node === 'string') out.push({ where, locale, message: node })
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`, locale)
  }
  for (const locale of readdirSync(root)) for (const file of readdirSync(path.join(root, locale))) walk(JSON.parse(readFileSync(path.join(root, locale, file), 'utf8')), `${locale}/${file}`, locale)
  return out
}

/** The arguments a message takes, from the real parser's tree: [name, kind, option names]. @param {any[]} ast @param {Map<string, { kind: string, options: Set<string> }>} into */
function argsOf(ast, into) {
  for (const el of ast) {
    if (el.type === 0 || el.type === 7) continue
    const entry = into.get(el.value) ?? { kind: 'simple', options: new Set() }
    if (el.type === 6) entry.kind = 'plural'
    if (el.type === 5) entry.kind = 'select'
    if (el.type === 2) entry.kind = 'number'
    for (const [key, option] of Object.entries(el.options ?? {})) {
      entry.options.add(key)
      argsOf(/** @type {{ value: any[] }} */ (option).value, into)
    }
    into.set(el.value, entry)
  }
}

/** Value sets for a message: every plural at a few numbers, every select at each of its options and one it does not name. @param {Map<string, { kind: string, options: Set<string> }>} args */
function valueSets(args) {
  /** @type {Record<string, unknown>[]} */
  let sets = [{}]
  for (const [name, { kind, options }] of args) {
    const choices = kind === 'plural' ? [0, 1, 2, 3, 5, 11, 100, 1234] : kind === 'select' ? [...[...options].filter((o) => o !== 'other'), 'something else'] : kind === 'number' ? [7, 1234567] : ['Ayesha <b>&</b>']
    sets = sets.flatMap((s) => choices.map((c) => ({ ...s, [name]: c })))
  }
  return sets.slice(0, 40)
}

describe('icu-lite against intl-messageformat', () => {
  const all = messages()

  it('has the catalogs to compare', () => {
    expect(all.length).toBeGreaterThan(300)
    expect(all.filter((m) => m.message.includes(', plural,')).length).toBeGreaterThan(8)
    expect(all.filter((m) => m.message.includes(', select,')).length).toBeGreaterThan(0)
  })

  it('gives the same text for every message of every catalog', () => {
    /** @type {string[]} */
    const different = []
    for (const { where, locale, message } of all) {
      const real = new IntlMessageFormat(message, locale, undefined, { ignoreTag: true })
      const args = new Map()
      argsOf(real.getAst(), args)
      for (const values of valueSets(args)) {
        const want = real.format(values)
        const got = format(message, locale, values)
        if (want !== got) different.push(`${where} ${JSON.stringify(values)}: ${JSON.stringify(got)} instead of ${JSON.stringify(want)}`)
      }
    }
    expect(different).toEqual([])
  })

  it('knows the apostrophe rules of ICU', () => {
    for (const m of ["can't", "it''s", "'{'braces'}'", "a ' b", "it ' s}", "{n, plural, other {'#' left}}", "{n, plural, one {# item's} other {# items}}"]) {
      expect(format(m, 'en', { n: 2 }), m).toBe(new IntlMessageFormat(m, 'en', undefined, { ignoreTag: true }).format({ n: 2 }))
    }
  })

  it('shows the message as written when it cannot be formatted, as the plug-in it replaces did', () => {
    const lite = new LiteICU()
    for (const bad of ['Hello {name}', '{n, plural, other {# left}', 'a { b', '{n, date, short}', '{n, plural, offset:1 other {#}}', "{n, plural, one {# item's} other {# items'}}"]) {
      expect(lite.parse(bad, {}, 'en'), bad).toBe(bad)
    }
  })

  it('formats numbers for the language of the page', () => {
    expect(format('{n, plural, other {# items}}', 'en', { n: 1234 })).toBe('1,234 items')
    expect(format('{n, number}', 'en', { n: 1234567 })).toBe('1,234,567')
  })
})
