// Keyboard shortcuts (plan/07-admin/15-shortcuts.md). `useShortcut(keys, handler, options)` is how a screen asks for a key; `startShortcuts()` is the one place a key event is read (a single
// `keydown` listener on the document, started by the shell), and the same registrations feed the help sheet and the command palette, so neither can be out of date.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { getPrefs } from './prefs'

/**
 * @typedef {object} Options
 * @property {boolean | (() => boolean)} [when] - the shortcut is live only while this is true (a permission, an action the server allows); a function is asked at the moment of the key, for what changes without a redraw (which field has the focus)
 * @property {string} [label] - what it does, for the help sheet, the tooltip and the palette
 * @property {'Global' | 'Lists' | 'This screen'} [group]
 * @property {boolean} [inFields] - runs while the person is typing in a field (Escape that leaves the field)
 * @property {boolean} [inOverlay] - runs while a dialog or drawer is open (Mod S, Mod K, Escape)
 * @property {boolean} [palette] - also an action in the command palette
 */
/** @typedef {{ keys: string; handler: (e: KeyboardEvent) => void; when: boolean | (() => boolean); label?: string; group: 'Global' | 'Lists' | 'This screen'; inFields: boolean; inOverlay: boolean; palette: boolean }} Entry */

/** @type {Set<{ current: Entry }>} */
const entries = new Set()

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** The shifted symbol a US keyboard makes and the key under it, so `Shift ]` and `?` are found by the character typed. */
const unshifted = /** @type {Record<string, string>} */ ({ '?': '/', '}': ']', '{': '[', '<': ',', '>': '.', '~': '`' })

/**
 * `mod+k`, `shift+d`, `g d` (a key and then another), `/`, `escape`, `arrowdown`, `space` as a description of a key press.
 * @param {string} keys
 */
export function parseKeys(keys) {
  return keys.split(' ').map((step) => {
    const parts = step.toLowerCase().split('+')
    const key = parts.at(-1) === '' ? '+' : /** @type {string} */ (parts.at(-1))
    const mods = new Set(parts.slice(0, -1))
    return { key: key === 'space' ? ' ' : key, mod: mods.has('mod'), shift: mods.has('shift'), alt: mods.has('alt') }
  })
}

/**
 * Whether a key event is the step of a shortcut. Letters match the character typed (not the physical key), a letter's Shift must match exactly, and a symbol such as `?` is matched as typed.
 * @param {{ key: string; mod: boolean; shift: boolean; alt: boolean }} step
 * @param {Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>} e
 * @param {boolean} [mac]
 */
export function matches(step, e, mac = isMac()) {
  const mod = mac ? e.metaKey : e.ctrlKey
  if (step.mod !== mod || (mac ? e.ctrlKey : e.metaKey) || step.alt !== e.altKey) return false
  const typed = e.key.toLowerCase()
  if (step.shift) return e.shiftKey && (typed === step.key || unshifted[typed] === step.key)
  const letter = /^[a-z]$/.test(step.key)
  if (letter && e.shiftKey) return false
  return typed === step.key
}

/** What the keys read as on screen: `Ctrl K` or `⌘ K`, `Shift D`, `g then d`, `↓`. @param {string} keys @param {boolean} [mac] */
export function formatKeys(keys, mac = isMac()) {
  const names = /** @type {Record<string, string>} */ ({ arrowdown: '↓', arrowup: '↑', arrowleft: '←', arrowright: '→', escape: 'Esc', enter: 'Enter', ' ': 'Space' })
  return parseKeys(keys)
    .map((s) => {
      const loud = s.mod || s.shift || s.alt // with a modifier a letter is written as a capital, as on a keycap
      const key = names[s.key] ?? (loud ? s.key.toUpperCase() : s.key)
      return [s.mod ? (mac ? '⌘' : 'Ctrl') : '', s.shift ? 'Shift' : '', s.alt ? 'Alt' : '', key].filter(Boolean).join(' ')
    })
    .join(' then ')
}

/** Ask for a key. The handler runs only while `when` holds, never while the person types in a field, and only a `Mod` shortcut runs when single-key shortcuts are off or a dialog is open. @param {string} keys @param {(e: KeyboardEvent) => void} handler @param {Options} [options] */
export function useShortcut(keys, handler, { when = true, label, group = 'This screen', inFields = false, inOverlay = false, palette = false } = {}) {
  const entry = useRef(/** @type {Entry} */ ({ keys, handler, when, label, group, inFields, inOverlay, palette }))
  useLayoutEffect(() => {
    entry.current = { keys, handler, when, label, group, inFields, inOverlay, palette }
  })
  useEffect(() => {
    entries.add(entry)
    return () => void entries.delete(entry)
  }, [])
}

/** The shortcuts alive now, for the help sheet and the palette. */
const isLive = (/** @type {Entry} */ e) => (typeof e.when === 'function' ? e.when() : e.when)
export const liveShortcuts = () => [...entries].map((e) => e.current).filter((e) => isLive(e) && e.label)

/** The tooltip text of a control that has a shortcut: "Confirm order · Shift C". @param {string} label @param {string} keys */
export const withKeys = (label, keys) => `${label} · ${formatKeys(keys)}`

const typing = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role=combobox], [role=textbox], [role=menu], [role=menuitem], [role=listbox], [role=option], [role=searchbox]'
const pressable = 'a, button, summary, [role=button], [role=checkbox], [role=switch], [role=radio], [role=tab]'

/**
 * Whether the event comes from somewhere a bare key means something else: a field, an open menu, a control that Enter or Space presses.
 * @param {KeyboardEvent} e
 */
function inTarget(e) {
  const t = /** @type {Element | null} */ (e.target instanceof Element ? e.target : null)
  if (!t) return false
  if (t.closest(typing)) return true
  return (e.key === 'Enter' || e.key === ' ') && t.closest(pressable) !== null
}

let pending = /** @type {{ key: string; at: number } | null} */ (null)
export const SEQUENCE_MS = 1000

/** @param {KeyboardEvent} e */
function onKey(e) {
  if (e.isComposing) return
  const live = [...entries].map((r) => r.current).filter(isLive)
  const overlay = document.querySelector('[role=dialog], [role=alertdialog]') !== null
  const single = getPrefs().singleKeyShortcuts
  const fieldy = inTarget(e)
  /** @param {Entry} x */
  const allowed = (x) => {
    const first = /** @type {NonNullable<ReturnType<typeof parseKeys>[0]>} */ (parseKeys(x.keys)[0])
    if (overlay && !x.inOverlay) return false
    if (!first.mod && !single) return false
    if (fieldy && !(first.mod || x.inFields)) return false
    return true
  }

  // the second key of a sequence ("g" then "o")
  if (pending) {
    const { key, at } = pending
    pending = null
    if (Date.now() - at <= SEQUENCE_MS) {
      const hit = live.find((x) => {
        const steps = parseKeys(x.keys)
        return steps.length === 2 && allowed(x) && matches(/** @type {never} */ (steps[0]), { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }) && matches(/** @type {never} */ (steps[1]), e)
      })
      if (hit) {
        e.preventDefault()
        hit.handler(e)
        return
      }
    }
  }
  for (const x of live) {
    const steps = parseKeys(x.keys)
    if (steps.length === 1 && allowed(x) && matches(/** @type {never} */ (steps[0]), e)) {
      e.preventDefault()
      x.handler(e)
      return
    }
  }
  // the first key of a sequence waits for the next
  if (!e.ctrlKey && !e.metaKey && !e.altKey && live.some((x) => parseKeys(x.keys).length === 2 && allowed(x) && matches(/** @type {never} */ (parseKeys(x.keys)[0]), e))) pending = { key: e.key.toLowerCase(), at: Date.now() }
}

/** Starts the one listener. Call once from the shell; the cleanup removes it. */
export function startShortcuts() {
  document.addEventListener('keydown', onKey)
  return () => {
    document.removeEventListener('keydown', onKey)
    pending = null
  }
}
