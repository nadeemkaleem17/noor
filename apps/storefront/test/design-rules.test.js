// The rules of plan/06-storefront/15-design-system-v2.md section 9 that a grep can hold: colours and durations come from tokens, and no text is set below 12 px.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../app')
/** @type {{ file: string, text: string }[]} */
const sources = []
/** @param {string} dir */
function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) collect(p)
    else if (/\.jsx?$/.test(e.name)) sources.push({ file: path.relative(root, p), text: readFileSync(p, 'utf8') })
  }
}
collect(root)

/** Every line of every source that matches, as "file:line". @param {RegExp} re */
const hits = (re) => sources.flatMap(({ file, text }) => text.split('\n').flatMap((line, i) => (re.test(line) ? [`${file}:${i + 1}`] : [])))

describe('the storefront takes its look from the tokens', () => {
  it('has no colour written out in a component (a hex value or rgb())', () => {
    expect(hits(/['"`]#[0-9a-fA-F]{3,8}['"`]|\brgba?\(/)).toEqual([])
  })
  it('has no duration written out as a number of milliseconds in a class (it comes from --dur-*)', () => {
    expect(hits(/\b(duration|animate-\[)[-\w]*-?\[?\d+m?s?\]?/).filter((h) => !h.startsWith('routes/design'))).toEqual([])
  })
  it('has no text size under 12 px (text-xs is 11 px; an arbitrary size under 12)', () => {
    expect(hits(/\btext-xs\b|text-\[(?:[0-9]|1[01])px\]/)).toEqual([])
  })
  it('uses the type scale for its headings: no heading is set with a raw size class', () => {
    expect(hits(/<h[12][^>]*font-heading text-(?:xl|2xl|3xl|4xl|5xl)\b/)).toEqual([])
  })
})
