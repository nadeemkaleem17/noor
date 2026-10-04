import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../cn'
import { floating, listItem } from './overlay-styles'

export type MenuItem = {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  tone?: 'neutral' | 'danger'
  disabled?: boolean
}

export type MenuProps = {
  trigger: ReactElement
  items: MenuItem[]
  align?: 'start' | 'center' | 'end'
}

/** Actions menu. Enter, Space or ArrowDown on the trigger opens it; arrows, Home, End and typing move; Esc closes and returns focus. */
export function Menu({ trigger, items, align = 'start' }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner align={align} sideOffset={4} className="z-popover">
          <BaseMenu.Popup className={cn(floating, 'min-w-40')}>
            {items.map((item, i) => (
              <BaseMenu.Item
                key={i}
                disabled={item.disabled}
                onClick={item.onSelect}
                className={cn(listItem, item.tone === 'danger' && 'text-danger')}
              >
                {item.icon ? <span aria-hidden className="shrink-0">{item.icon}</span> : null}
                {item.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
