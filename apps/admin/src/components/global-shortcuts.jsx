import { useNavigate } from 'react-router'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { useNavCounts } from '@/lib/nav-counts'
import { useCan } from '@/lib/session'
import { useShortcut } from '@/lib/shortcuts'

/** The sequences `g` then a letter, and where each goes (plan/07-admin/15-shortcuts.md section 2). Reviews only while the store has them on. */
const places = /** @type {const} */ ([
  ['d', '/', 'Go to Dashboard', 'dashboard:read'],
  ['o', '/orders', 'Go to Orders', 'orders:read'],
  ['p', '/products', 'Go to Products', 'products:read'],
  ['c', '/customers', 'Go to Customers', 'customers:read'],
  ['r', '/reviews', 'Go to Reviews', 'reviews:read'],
  ['s', '/settings/store', 'Go to Store settings', 'settings:read'],
])

/** The form the key should save: the one the person is in, a dialog's form, or the only form of the screen. */
function formToSave() {
  const scope = document.querySelector('[role=dialog]') ?? document.querySelector('main')
  const active = document.activeElement
  const own = active instanceof Element ? active.closest('form') : null
  if (own && scope?.contains(own) && own.getAttribute('role') !== 'search') return own
  const forms = scope ? [...scope.querySelectorAll('form:not([role=search])')] : []
  return forms.length === 1 ? /** @type {HTMLFormElement} */ (forms[0]) : null
}

/**
 * The shortcuts of every screen. One component, so the list is in one place; nothing here changes data: a key opens something or moves, and a form is saved through its own Save.
 * @param {{ onPalette: () => void; onHelp: () => void }} props
 */
export function GlobalShortcuts({ onPalette, onHelp }) {
  const navigate = useNavigate()
  const can = useCan()
  const counts = useNavCounts()
  const { sidebarCollapsed } = usePrefs()

  useShortcut('mod+k', onPalette, { group: 'Global', label: 'Search and commands', inOverlay: true })
  useShortcut('?', onHelp, { group: 'Global', label: 'Show the shortcuts' })
  useShortcut(
    '/',
    () => {
      const box = document.querySelector('main input[type=search], main [role=search] input')
      if (box instanceof HTMLElement) box.focus()
    },
    { group: 'Global', label: 'Go to the search box of the screen', when: true },
  )
  for (const [letter, path, label, permission] of places) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the list is fixed, so the hooks come in the same order every time
    useShortcut(`g ${letter}`, () => void navigate(path), { group: 'Global', label, when: can(permission) && (path !== '/reviews' || counts?.reviewsPending !== undefined) })
  }
  useShortcut('[', () => setPrefs({ sidebarCollapsed: !sidebarCollapsed }), { group: 'Global', label: 'Collapse or open the menu' })
  useShortcut('mod+s', () => formToSave()?.requestSubmit(), { group: 'Global', label: 'Save the form', inOverlay: true })
  // out of a field when no dialog is open; the dialogs and menus close themselves on Escape
  // (only while a field has the focus, so that the Escape of a list, which clears its selection, is not taken by this one)
  useShortcut(
    'escape',
    () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    },
    { group: 'Global', inFields: true, when: () => document.activeElement instanceof HTMLElement && document.activeElement.matches('input, textarea, select') && !document.querySelector('[role=dialog], [role=menu], [role=listbox]') },
  )
  return null
}
