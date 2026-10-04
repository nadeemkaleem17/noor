import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Link } from './link'

/**
 * @typedef {object} Props
 * @property {number} page
 * @property {number} pageCount
 * @property {(page: number) => string} [hrefFor] - Storefront: real links, so crawlers can follow them.
 * @property {(page: number) => void} [onPageChange] - Admin tables: no URL, a callback instead.
 * @property {import('@base-ui/react/use-render').useRender.RenderProp} [renderLink]
 * @property {string} [label] - Accessible name of the nav; give each a different one when a page has two paginations.
 * @property {string} [className]
 */

/**
 * Page numbers to show: first, last, the current page and its neighbours, with `null` for a gap.
 * @param {number} page
 * @param {number} pageCount
 * @returns {(number | null)[]}
 */
export function pageWindow(page, pageCount) {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1])
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  return pages.flatMap((p, i) => (i > 0 && p - (pages[i - 1] ?? p) > 1 ? [null, p] : [p]))
}

const item = 'inline-flex size-9 items-center justify-center rounded-control text-sm tabular-nums'

/**
 * @param {Props} props
 */
export function Pagination({ page, pageCount, hrefFor, onPageChange, renderLink, label, className }) {
  const { t } = useTranslation()
  if (pageCount <= 1) return null
  /**
   * @param {number} target
   * @param {React.ReactNode} content
   * @param {string} label
   */
  const control = (target, content, label, current = false, disabled = false) => {
    const cls = cn(item, current ? 'bg-accent text-on-accent' : 'text-fg hover:bg-surface-2', disabled && 'pointer-events-none opacity-50')
    if (hrefFor && !disabled) {
      return (
        <Link href={hrefFor(target)} render={renderLink} aria-label={label} aria-current={current ? 'page' : undefined} className={cls}>
          {content}
        </Link>
      )
    }
    return (
      <button type="button" aria-label={label} aria-current={current ? 'page' : undefined} disabled={disabled} onClick={() => onPageChange?.(target)} className={cls}>
        {content}
      </button>
    )
  }
  return (
    <nav aria-label={label ?? t('pagination')} className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>{control(page - 1, <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />, t('previous'), false, page <= 1)}</li>
        {pageWindow(page, pageCount).map((p, i) => (
          <li key={p ?? `gap-${i}`}>{p === null ? <span aria-hidden className={cn(item, 'text-muted')}>{'…'}</span> : control(p, p, t('page', { n: p }), p === page)}</li>
        ))}
        <li>{control(page + 1, <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />, t('next'), false, page >= pageCount)}</li>
      </ul>
    </nav>
  )
}
