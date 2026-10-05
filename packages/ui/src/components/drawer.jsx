import { Dialog } from './dialog'

/**
 * @typedef {Omit<import('./dialog').DialogProps, 'placement'> & { side?: 'start' | 'end'; }} DrawerProps
 */

/**
 * A panel from the inline-end edge (right in English, left in Urdu); a bottom sheet on narrow screens. `side="start"` is the navigation drawer: the opposite edge at every width. Same props as Dialog otherwise.
 * @param {DrawerProps} props
 */
export function Drawer({ side = 'end', ...props }) {
  return <Dialog {...props} placement={side} />
}
