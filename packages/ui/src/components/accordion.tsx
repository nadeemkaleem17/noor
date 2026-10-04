import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'

export type AccordionItem = { id: string; title: ReactNode; content: ReactNode }

type Props = {
  items: AccordionItem[]
  /** Several panels may be open at once. Default: opening one closes the others. */
  multiple?: boolean
  defaultOpen?: string[]
  className?: string
}

// Base UI 1.8 does not move focus between accordion headers (WAI-ARIA recommends it, DOC-04b section 5), so it is done here.
function moveBetweenHeaders(e: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(e.key)) return
  const headers = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-accordion-trigger]:not([disabled])')]
  const at = headers.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  e.preventDefault()
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? headers.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + headers.length) % headers.length
  headers[next]?.focus()
}

/** Product details, FAQ, mobile filter groups. Enter or Space toggles; ArrowDown, ArrowUp, Home and End move between headers. */
export function Accordion({ items, multiple, defaultOpen, className }: Props) {
  return (
    <BaseAccordion.Root multiple={multiple} defaultValue={defaultOpen} className={className} onKeyDown={moveBetweenHeaders}>
      {items.map((item) => (
        <BaseAccordion.Item key={item.id} value={item.id} className="border-b border-line">
          <BaseAccordion.Header>
            <BaseAccordion.Trigger data-accordion-trigger="" className="group flex w-full items-center justify-between gap-3 py-3 text-start text-(length:--control-text) font-medium">
              {item.title}
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-(--dur-small) group-data-[panel-open]:rotate-180" />
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel className="pb-4 text-fg-soft">{item.content}</BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  )
}
