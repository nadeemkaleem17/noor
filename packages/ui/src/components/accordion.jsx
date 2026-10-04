import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'

/**
 * @typedef {object} AccordionItem
 * @property {string} id
 * @property {import('react').ReactNode} title
 * @property {import('react').ReactNode} content
 */

/**
 * @typedef {object} Props
 * @property {AccordionItem[]} items
 * @property {boolean} [multiple] - Several panels may be open at once. Default: opening one closes the others.
 * @property {string[]} [defaultOpen]
 * @property {string} [className]
 */

// Base UI 1.8 does not move focus between accordion headers (WAI-ARIA recommends it, DOC-04b section 5), so it is done here.
/**
 * @param {import('react').KeyboardEvent<HTMLElement>} e
 */
function moveBetweenHeaders(e) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(e.key)) return
  const headers = [.../** @type {NodeListOf<HTMLElement>} */ (e.currentTarget.querySelectorAll('[data-accordion-trigger]:not([disabled])'))]
  const at = headers.indexOf(/** @type {HTMLElement} */ (document.activeElement))
  if (at < 0) return
  e.preventDefault()
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? headers.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + headers.length) % headers.length
  headers[next]?.focus()
}

/**
 * Product details, FAQ, mobile filter groups. Enter or Space toggles; ArrowDown, ArrowUp, Home and End move between headers.
 * @param {Props} props
 */
export function Accordion({ items, multiple, defaultOpen, className }) {
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
