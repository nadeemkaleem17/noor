import { Dialog, type DialogProps } from './dialog'

export type DrawerProps = Omit<DialogProps, 'placement'>

/** A panel from the inline-end edge (right in English, left in Urdu); a bottom sheet on narrow screens. Same props as Dialog. */
export function Drawer(props: DrawerProps) {
  return <Dialog {...props} placement="end" />
}
