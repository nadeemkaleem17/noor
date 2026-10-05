// Interface preferences in this browser only (plan/03 section 6): never domain data.
import { z } from '@noor/contract'
import { useSyncExternalStore } from 'react'

const KEY = 'noor.admin.prefs'
const Prefs = z.object({
  theme: z.enum(['light', 'dark', 'system']).catch('system'),
  sidebarCollapsed: z.boolean().catch(false),
  density: z.enum(['comfortable', 'compact']).catch('comfortable'),
})
/** @typedef {z.infer<typeof Prefs>} Prefs */

function load() {
  try {
    return Prefs.parse(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return Prefs.parse({})
  }
}

let state = load()
const listeners = new Set()

/** @param {Prefs['theme']} theme */
export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

/** @param {Partial<Prefs>} patch */
export function setPrefs(patch) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // private mode or storage blocked: the choice lasts until the page closes
  }
  if (patch.theme) applyTheme(state.theme)
  listeners.forEach((l) => l())
}

/** Applies the saved theme and follows the operating system while it is "system". Call once at start-up. */
export function startTheme() {
  applyTheme(state.theme)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.theme === 'system' && applyTheme('system'))
}

export const usePrefs = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
