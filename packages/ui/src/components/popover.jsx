import { Popover as BasePopover } from '@base-ui/react/popover'
import { cn } from '../cn'
import { floating } from './overlay-styles'

/**
 * @typedef {object} PopoverProps
 * @property {import('react').ReactElement} trigger
 * @property {string} label - Accessible name of the panel.
 * @property {import('react').ReactNode} children
 * @property {'top' | 'bottom' | 'inline-start' | 'inline-end'} [side] - Logical sides, so `inline-end` is the left in Urdu.
 * @property {'start' | 'center' | 'end'} [align]
 * @property {boolean} [open]
 * @property {(open: boolean) => void} [onOpenChange]
 * @property {string} [className]
 */

/**
 * @param {PopoverProps} props
 */
export function Popover({ trigger, label, children, side = 'bottom', align = 'start', open, onOpenChange, className }) {
  return (
    <BasePopover.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={8} className="z-popover">
          <BasePopover.Popup aria-label={label} className={cn(floating, 'p-3 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-(--dur-micro)', className)}>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
