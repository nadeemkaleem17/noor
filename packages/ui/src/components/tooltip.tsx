import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { floating } from './overlay-styles'

export type TooltipProps = {
  content: ReactNode
  /** The element the tooltip describes. It must accept a ref and props (a Button, IconButton or native element). */
  children: ReactElement
  /** Milliseconds before it shows. Set explicitly: Base UI's own default is shorter (ADR-0007). */
  delay?: number
  side?: 'top' | 'bottom' | 'inline-start' | 'inline-end'
}

/** Extra hint for a mouse or keyboard user. Never the only way to learn something; not shown on touch. */
export function Tooltip({ content, children, delay = 300, side = 'top' }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={delay} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-popover">
          <BaseTooltip.Popup className={`${floating} px-2 py-1 text-sm transition-opacity duration-(--dur-micro) data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`}>
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
