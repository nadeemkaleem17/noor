import { Menu as BaseMenu } from '@base-ui/react/menu'
import { cn } from '../cn'
import { floating, listItem } from './overlay-styles'

/**
 * @typedef {object} MenuItem
 * @property {import('react').ReactNode} label
 * @property {import('react').ReactNode} [icon]
 * @property {() => void} onSelect
 * @property {'neutral' | 'danger'} [tone]
 * @property {boolean} [disabled]
 */

/**
 * @typedef {object} MenuProps
 * @property {import('react').ReactElement} trigger
 * @property {MenuItem[]} items
 * @property {'start' | 'center' | 'end'} [align]
 */

/**
 * Actions menu. Enter, Space or ArrowDown on the trigger opens it; arrows, Home, End and typing move; Esc closes and returns focus.
 * @param {MenuProps} props
 */
export function Menu({ trigger, items, align = 'start' }) {
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
