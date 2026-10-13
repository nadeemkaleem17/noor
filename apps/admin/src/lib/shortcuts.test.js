// How a key is described and recognised (plan/07-admin/15-shortcuts.md section 5). Pure: no page, no listener.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatKeys, matches, parseKeys, withKeys } from './shortcuts'

const ev = (/** @type {string} */ key, /** @type {Partial<KeyboardEvent>} */ over = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over })
const step = (/** @type {string} */ keys) => /** @type {NonNullable<ReturnType<typeof parseKeys>[0]>} */ (parseKeys(keys)[0])

describe('describing keys', () => {
  it('reads a key, its modifiers and a sequence', () => {
    expect(parseKeys('mod+k')).toEqual([{ key: 'k', mod: true, shift: false, alt: false }])
    expect(parseKeys('shift+d')).toEqual([{ key: 'd', mod: false, shift: true, alt: false }])
    expect(parseKeys('g o').map((s) => s.key)).toEqual(['g', 'o'])
    expect(parseKeys('space')[0]?.key).toBe(' ')
  })
  it('writes keys the way a person reads them, for the Ctrl or the Command key', () => {
    expect(formatKeys('mod+k', false)).toBe('Ctrl K')
    expect(formatKeys('mod+k', true)).toBe('⌘ K')
    expect(formatKeys('shift+c')).toBe('Shift C')
    expect(formatKeys('g o')).toBe('g then o')
    expect(formatKeys('arrowdown')).toBe('↓')
    expect(formatKeys('?')).toBe('?')
    expect(withKeys('Confirm order', 'shift+c')).toBe('Confirm order · Shift C')
  })
})

describe('recognising a key press', () => {
  it('matches the character typed, with its modifiers exactly', () => {
    expect(matches(step('j'), ev('j'), false)).toBe(true)
    expect(matches(step('j'), ev('J', { shiftKey: true }), false)).toBe(false) // a letter's Shift must match
    expect(matches(step('shift+d'), ev('D', { shiftKey: true }), false)).toBe(true)
    expect(matches(step('shift+d'), ev('d'), false)).toBe(false)
    expect(matches(step('j'), ev('j', { ctrlKey: true }), false)).toBe(false) // a bare key is not Ctrl with it
    expect(matches(step('j'), ev('j', { altKey: true }), false)).toBe(false)
  })
  it('takes Ctrl on a PC and Command on a Mac, and not the other', () => {
    expect(matches(step('mod+k'), ev('k', { ctrlKey: true }), false)).toBe(true)
    expect(matches(step('mod+k'), ev('k', { metaKey: true }), false)).toBe(false)
    expect(matches(step('mod+k'), ev('k', { metaKey: true }), true)).toBe(true)
    expect(matches(step('mod+k'), ev('k', { ctrlKey: true }), true)).toBe(false)
    expect(matches(step('mod+k'), ev('k'), false)).toBe(false)
  })
  it('finds a symbol as typed, and Shift ] on a keyboard that makes } of it', () => {
    expect(matches(step('?'), ev('?', { shiftKey: true }), false)).toBe(true)
    expect(matches(step(']'), ev(']'), false)).toBe(true)
    expect(matches(step(']'), ev('}', { shiftKey: true }), false)).toBe(false)
    expect(matches(step('shift+]'), ev('}', { shiftKey: true }), false)).toBe(true)
    expect(matches(step('shift+]'), ev(']', { shiftKey: true }), false)).toBe(true)
  })
  it('works on a layout where the letter is somewhere else, because it reads the character', () => {
    // on an AZERTY keyboard the key that makes "a" is where QWERTY has "q": the event says "a" either way
    expect(matches(step('a'), ev('a'), false)).toBe(true)
  })
})

describe('one place for key events', () => {
  /** @param {string} dir @returns {string[]} */
  const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f) ? [path.join(dir, f)] : []))
  it('only lib/shortcuts.js adds a keydown listener to the document', () => {
    const src = path.resolve(import.meta.dirname, '..')
    const hits = files(src).filter((f) => /addEventListener\(\s*['"]keydown['"]/.test(readFileSync(f, 'utf8')))
    expect(hits.map((f) => path.relative(src, f).replace(/\\/g, '/'))).toEqual(['lib/shortcuts.js'])
  })
})
