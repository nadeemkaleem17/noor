import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'
import { cn } from '../cn'

export type TabItem = { value: string; label: ReactNode; count?: number; disabled?: boolean }

const indicator = 'absolute bottom-0 h-0.5 bg-accent transition-[left,width] duration-(--dur-small) [left:var(--active-tab-left)] [width:var(--active-tab-width)]' // physical: Base UI measures the active tab from the physical left edge in both directions

type Props = {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  /** Accessible name of the tab list. */
  'aria-label'?: string
  /** `TabsPanel` elements. Omit when the tabs only drive a URL and the page renders the content itself. */
  children?: ReactNode
  className?: string
}

/** Left and Right arrows move between tabs and follow the page direction (swapped in RTL); Home and End jump to the ends. */
export function Tabs({ items, value, onValueChange, children, className, ...aria }: Props) {
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

export function TabsPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <BaseTabs.Panel value={value} className={cn('pt-4', className)}>
      {children}
    </BaseTabs.Panel>
  )
}
