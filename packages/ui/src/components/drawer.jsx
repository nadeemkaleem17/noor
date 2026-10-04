import { Dialog } from './dialog'

/**
 * @typedef {Omit<import('./dialog').DialogProps, 'placement'>} DrawerProps
 */

/**
 * A panel from the inline-end edge (right in English, left in Urdu); a bottom sheet on narrow screens. Same props as Dialog.
 * @param {DrawerProps} props
 */
export function Drawer(props) {
  return <Dialog {...props} placement="end" />
}
