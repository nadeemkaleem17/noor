import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { cn } from '../cn'

/**
 * @typedef {object} TabItem
 * @property {string} value
 * @property {import('react').ReactNode} label
 * @property {number} [count]
 * @property {boolean} [disabled]
 */

const indicator = 'absolute bottom-0 h-0.5 bg-accent transition-[left,width] duration-(--dur-small) [left:var(--active-tab-left)] [width:var(--active-tab-width)]' // physical: Base UI measures the active tab from the physical left edge in both directions

/**
 * @typedef {object} Props
 * @property {TabItem[]} items
 * @property {string} value
 * @property {(value: string) => void} onValueChange
 * @property {string} [aria-label] - Accessible name of the tab list.
 * @property {import('react').ReactNode} [children] - `TabsPanel` elements. Omit when the tabs only drive a URL and the page renders the content itself.
 * @property {string} [className]
 */

/**
 * Left and Right arrows move between tabs and follow the page direction (swapped in RTL); Home and End jump to the ends.
 * @param {Props} props
 */
export function Tabs({ items, value, onValueChange, children, className, ...aria }) {
  return (
    <BaseTabs.Root value={value} onValueChange={(v) => onValueChange(String(v))} className={className}>
      <BaseTabs.List className="relative flex gap-1 overflow-x-auto border-b border-line" {...aria}>
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-(length:--control-text) text-muted hover:text-fg data-[active]:text-fg data-[active]:font-medium data-[disabled]:opacity-50"
          >
            {item.label}
            {item.count === undefined ? null : <span className="rounded-control bg-surface-2 px-1.5 text-xs tabular-nums">{item.count}</span>}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className={indicator} />
      </BaseTabs.List>
      {children}
    </BaseTabs.Root>
  )
}

/**
 * @param {{ value: string; children: import('react').ReactNode; className?: string; }} props
 */
export function TabsPanel({ value, children, className }) {
  return (
    <BaseTabs.Panel value={value} className={cn('pt-4', className)}>
      {children}
    </BaseTabs.Panel>
  )
}
