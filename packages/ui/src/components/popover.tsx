import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../cn'
import { floating } from './overlay-styles'

export type PopoverProps = {
  trigger: ReactElement
  /** Accessible name of the panel. */
  label: string
  children: ReactNode
  /** Logical sides, so `inline-end` is the left in Urdu. */
  side?: 'top' | 'bottom' | 'inline-start' | 'inline-end'
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Popover({ trigger, label, children, side = 'bottom', align = 'start', open, onOpenChange, className }: PopoverProps) {
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
