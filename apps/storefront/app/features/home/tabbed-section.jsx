import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { ProductGrid } from '../catalog/product-card'
import { useHydrated } from '../catalog/filters'
import { useLocalePath } from '../layout/use-shell'

/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */

const chip = 'inline-flex min-h-11 items-center rounded-full border px-4 text-small'

/**
 * "New in" or "Bestsellers" with a tab for each top category (DOC-06.13 section 5). The tabs are ordinary links to the category's own page, so without JavaScript each one works; with
 * it the pieces of the chosen category replace the grid in place (fetched when asked for, kept for the next time). The first tab, "All", is what the server drew.
 * Fewer than four pieces is not a section; fewer than two categories need no tabs.
 * @param {{ id: string, title: string, href: string, sort: 'newest' | 'bestselling', items: ProductSummary[], categories: { id: string, handle: string, name: string }[] }} props
 */
export function TabbedSection({ id, title, href, sort, items, categories }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const hydrated = useHydrated()
  const [active, setActive] = useState('')
  const [fetched, setFetched] = useState(/** @type {Record<string, ProductSummary[] | 'failed'>} */ ({}))
  if (items.length < 4) return null
  const shown = active === '' ? items : fetched[active]
  const current = categories.find((c) => c.handle === active)
  const tabHref = (/** @type {string} */ handle) => (handle ? `/c/${handle}?sort=${sort}` : href)

  /** @param {string} handle */
  async function choose(handle) {
    setActive(handle)
    if (!handle || fetched[handle]) return
    try {
      const res = await fetch(path(`/home/rail?category=${encodeURIComponent(handle)}&sort=${sort}`))
      const body = await res.json()
      setFetched((f) => ({ ...f, [handle]: res.ok && Array.isArray(body.items) ? body.items : 'failed' }))
    } catch {
      setFetched((f) => ({ ...f, [handle]: 'failed' }))
    }
  }

  return (
    <section className="defer-render mx-auto max-w-7xl px-4 py-8" aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="font-heading text-h2">
          {title}
        </h2>
        <RouterLink to={path(tabHref(active))} className="text-sm underline underline-offset-4">
          {current ? t('home.viewAllOf', { name: current.name }) : t('home.viewAll')}
        </RouterLink>
      </div>
      {categories.length > 1 ? (
        <ul aria-label={t('home.tabsLabel')} className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[{ id: 'all', handle: '', name: t('home.tabAll') }, ...categories].map((c) => (
            <li key={c.id} className="shrink-0">
              <RouterLink
                to={path(tabHref(c.handle))}
                aria-current={active === c.handle ? 'true' : undefined}
                className={`${chip} ${active === c.handle ? 'border-accent bg-accent text-on-accent' : 'border-line-strong hover:bg-surface-2'}`}
                onClick={(e) => {
                  if (!hydrated) return
                  e.preventDefault()
                  void choose(c.handle)
                }}
              >
                {c.name}
              </RouterLink>
            </li>
          ))}
        </ul>
      ) : null}
      <div aria-live="polite">
        {shown === 'failed' ? (
          <p role="alert" className="text-danger">{t('home.tabFailed')}</p>
        ) : shown ? (
          shown.length ? <ProductGrid items={shown} eager={0} /> : <p className="text-fg-soft">{t('home.tabEmpty')}</p>
        ) : (
          <p aria-busy="true" className="text-muted">{t('pdp.loading')}</p>
        )}
      </div>
    </section>
  )
}
