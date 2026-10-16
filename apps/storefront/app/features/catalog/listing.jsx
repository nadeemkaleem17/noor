import { lazy, Suspense, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetcher, useLocation, useNavigate, useNavigation, useNavigationType, useSearchParams } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { Button, LinkButton } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { NativeSelect } from '@noor/ui/native-select'
import { Skeleton } from '@noor/ui/skeleton'
import { clearAllHref, filterCount, listingHref } from '~/lib/listing-url'
import { canonicalQuery } from '~/lib/redirects'
import { asRouterLink } from '../layout/as-router-link'
import { useLocalePath } from '../layout/use-shell'
import { Applied, FilterForm, useHydrated } from './filters'
import { DensityToggle, useDensity } from './density'
import { recall, remember } from './listing-memory'
import { ProductGrid } from './product-card'

/** @typedef {import('@noor/contract').ProductListing} ProductListing */

const FiltersDrawer = lazy(() => import('./filters-drawer'))

/** After this many products the load-more button gives way to "Refine your results" (plan/06-storefront/03-plp-search.md section 6). */
const CAP = 240

/** The description of a category or collection: its first 300 characters, the rest behind "Read more". Plain text. @param {{ text: string }} props */
function Intro({ text }) {
  const { t } = useTranslation('storefront')
  if (text.length <= 300) return <p className="mt-2 max-w-prose text-fg-soft">{text}</p>
  return (
    <div className="mt-2 max-w-prose text-fg-soft">
      <p>{text.slice(0, 300)}…</p>
      <details>
        <summary className="cursor-pointer underline underline-offset-4">{t('listing.readMore')}</summary>
        <p className="mt-2">{text}</p>
      </details>
    </div>
  )
}

/** One more page of products, fetched when it is opened (a fetcher gets the same address with `cursor` and `chunk`, which makes the loader answer instead of throw). @param {{ cursor: string, depth: number, shown: number, total: number, base: string, memo: string, last: boolean }} props `last`: the Back button is bringing the visitor back and this is the last page they had open */
function Chunk({ cursor, depth, shown, total, base, memo, last }) {
  const { t } = useTranslation('storefront')
  const fetcher = useFetcher()
  const [attempt, setAttempt] = useState(0)
  const { load, data } = fetcher
  const density = useDensity()
  const href = `${base}${base.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}&chunk=1`

  useEffect(() => {
    void load(href)
    remember(memo, { n: Math.max(depth + 1, recall(memo).n) }) // never lower: the number is also what a Back is restoring to
  }, [load, href, memo, depth, attempt])

  // back to a listing: once the last page that was open is here again, the visitor is taken to where they were
  const ready = data && !data.failed
  useEffect(() => {
    if (ready && last) window.scrollTo(0, recall(memo).y)
  }, [ready, last, memo])

  if (!data) {
    return (
      <div aria-busy="true" className={`mt-8 grid gap-x-4 gap-y-8 ${density === 'roomy' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-3/4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    )
  }
  if (data.failed || !data.page) {
    return <ErrorState title={t('listing.loadFailed')} onRetry={() => setAttempt((n) => n + 1)} />
  }
  const items = data.page.items
  return (
    <>
      <div className="mt-8">
        <ProductGrid items={items} eager={0} density={density} />
      </div>
      <Pager shown={shown + items.length} total={total} next={data.page.nextCursor} depth={depth + 1} base={base} memo={memo} />
    </>
  )
}

const noopSubscribe = () => () => {}

/** "Showing 48 of 310" and the link to the next page: a real link, which with JavaScript opens the next page in place. @param {{ shown: number, total: number, next: string | undefined, depth: number, base: string, memo: string }} props */
function Pager({ shown, total, next, depth, base, memo }) {
  const { t } = useTranslation('storefront')
  const { t: c } = useTranslation('common')
  const [clicked, setClicked] = useState(false)
  // the pages that were open when the visitor left, if they come back with the Back button; read after hydration so the HTML the server sent is the one that is first drawn
  const back = useNavigationType() === 'POP'
  const was = useSyncExternalStore(noopSubscribe, () => (back ? recall(memo).n : 0), () => 0)
  if (next && (clicked || was > depth)) return <Chunk cursor={next} depth={depth} shown={shown} total={total} base={base} memo={memo} last={!clicked && was === depth + 1} />
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p role="status" className="text-sm text-muted">{c('showing', { shown, total })}</p>
      {next ? (
        shown >= CAP ? (
          <LinkButton href="#filters" variant="secondary">{t('listing.refine')}</LinkButton>
        ) : (
          <LinkButton
            href={`${base}${base.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(next)}`}
            variant="secondary"
            rel="next"
            onClick={(e) => {
              e.preventDefault()
              setClicked(true)
            }}
          >
            {c('loadMore')}
          </LinkButton>
        )
      ) : null}
    </div>
  )
}

/** Sorting: a form of its own that keeps every filter, so it works without JavaScript too. @param {{ path: string, search: URLSearchParams, effective: URLSearchParams, sorts: string[] }} props */
function Sort({ path, search, effective, sorts }) {
  const { t } = useTranslation('storefront')
  const navigate = useNavigate()
  const hydrated = useHydrated()
  const id = useId()
  const carried = [...search.entries()].filter(([k]) => k !== 'sort' && k !== 'cursor' && k !== 'chunk')
  return (
    <form method="get" action={path} onSubmit={(e) => {
      e.preventDefault()
      navigate(path + canonicalQuery(new URLSearchParams(/** @type {Record<string, string>} */ (/** @type {unknown} */ (new FormData(e.currentTarget))))), { preventScrollReset: true })
    }} className="flex items-center gap-2">
      {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
      <label htmlFor={id} className="whitespace-nowrap text-sm text-fg-soft">{t('listing.sort')}</label>
      <NativeSelect
        id={id}
        name="sort"
        size="sm"
        value={effective.get('sort') ?? sorts[0]}
        onChange={(e) => navigate(listingHref(path, search, { sort: e.target.value }), { preventScrollReset: true })}
        options={sorts.map((s) => ({ value: s, label: t(`listing.sorts.${s}`) }))}
      />
      {!hydrated ? <Button type="submit" size="sm" variant="secondary">{t('listing.apply')}</Button> : null}
    </form>
  )
}

/** The filters on a phone: a bottom sheet that applies them with its button; before JavaScript is there, an ordinary disclosure with the same form. @param {{ path: string, page: ProductListing, search: URLSearchParams, effective: URLSearchParams }} props */
function MobileFilters({ path, page, search, effective }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const [open, setOpen] = useState(false)
  // the drawer is downloaded the first time the button is pressed
  const [opened, setOpened] = useState(false)
  const formId = useId()
  const count = filterCount(search)
  const label = count ? t('listing.filtersCount', { count }) : t('listing.filters')
  if (!hydrated) {
    return (
      <details className="lg:hidden">
        <summary className="inline-flex h-(--control-h) cursor-pointer items-center rounded-control border border-line-strong px-4">{label}</summary>
        <div className="mt-3"><FilterForm id={formId} path={path} page={page} search={search} effective={effective} /></div>
      </details>
    )
  }
  return (
    <div className="lg:hidden">
      <Button variant="secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(true); setOpened(true) }}>{label}</Button>
      {opened ? (
        <Suspense fallback={null}>
          <FiltersDrawer open={open} onOpenChange={setOpen} formId={formId} path={path} page={page} search={search} effective={effective} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * The page of a listing (plan/06-storefront/03-plp-search.md section 2): heading, filters, sort, the products and the way to more of them. Everything the visitor chooses is in the
 * address; the first page of products is in the server's HTML.
 * @param {object} props
 * @param {{ label: string, href?: string }[]} props.crumbs hrefs are shop paths without the language
 * @param {string} props.title
 * @param {string} [props.intro]
 * @param {{ handle: string, name: string }[]} [props.subcategories]
 * @param {{ handle: string, name: string }[]} [props.siblings] the other categories at this level, as chips on a page with no sub-categories
 * @param {import('react').ReactNode} [props.lead] what comes between the heading and the products (a landing page's tiles and rails)
 * @param {ProductListing} props.page
 * @param {string[]} props.sorts the sorts that make sense here; the first is the default
 * @param {import('react').ReactNode} [props.zero] shown instead of the plain "nothing here" when the listing has no products and no filters (a search with no results)
 */
export function ListingPage({ crumbs, title, intro, subcategories = [], siblings = [], lead, page, sorts, zero }) {
  const { t } = useTranslation('storefront')
  const density = useDensity()
  const path = useLocalePath()
  const location = useLocation()
  const navigation = useNavigation()
  const navType = useNavigationType()
  const sideId = useId()
  const [search] = useSearchParams()
  const pending = navigation.state === 'loading' && navigation.location?.pathname === location.pathname
  const effective = new URLSearchParams(pending ? navigation.location?.search : location.search)
  const filtered = filterCount(search) > 0
  const clearHref = clearAllHref(location.pathname, search)
  // the address of this listing without its page: the base of the "load more" links, and the key of what is remembered for Back
  const quiet = new URLSearchParams(search)
  quiet.delete('cursor')
  const base = location.pathname + canonicalQuery(quiet)

  // where the visitor had scrolled, kept for Back
  useEffect(() => {
    // arriving by a link or a new filter starts a listing afresh; only Back (or a reload) brings the earlier state back
    if (navType !== 'POP') remember(base, { n: 0, y: 0 })
    // the position is saved only after the visitor's own scrolling, not the scrolls the browser or a restore do while the page is still filling up
    let live = false
    let timer = 0
    const arm = () => {
      live = true
    }
    const save = () => {
      if (!live) return
      clearTimeout(timer)
      timer = window.setTimeout(() => remember(base, { y: Math.round(window.scrollY) }), 100)
    }
    const own = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    for (const e of own) window.addEventListener(e, arm, { passive: true })
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const e of own) window.removeEventListener(e, arm)
      window.removeEventListener('scroll', save)
    }
  }, [base, navType])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumb items={crumbs.map((c) => ({ label: c.label, ...(c.href ? { href: path(c.href) } : {}) }))} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-h1">{title}</h1>
      {intro ? <Intro text={intro} /> : null}
      {subcategories.length || siblings.length ? (
        <ul aria-label={subcategories.length ? t('listing.subcategories') : t('listing.siblings')} className="mt-4 flex flex-wrap gap-2">
          {(subcategories.length ? subcategories : siblings).map((c) => (
            <li key={c.handle}>
              <RouterLink to={path(`/c/${c.handle}`)} className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-surface-2">{c.name}</RouterLink>
            </li>
          ))}
        </ul>
      ) : null}

      {lead}
      <div className="mt-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
        <aside id="filters" aria-label={t('listing.filters')} className="hidden lg:block">
          <FilterForm id={`${sideId}-side`} path={location.pathname} page={page} search={search} effective={effective} controlled />
        </aside>
        <div>
          <div className="sticky top-0 z-sticky -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg px-4 py-2">
            <p role="status" className="text-sm text-fg-soft">{t('listing.count', { count: page.total })}</p>
            <div className="flex items-center gap-3">
              <DensityToggle />
              <MobileFilters path={location.pathname} page={page} search={search} effective={effective} />
              <Sort path={location.pathname} search={search} effective={effective} sorts={sorts} />
            </div>
          </div>
          <div className="mt-3"><Applied path={location.pathname} page={page} search={search} /></div>

          <div aria-busy={pending} className={`mt-6 transition-opacity ${pending ? 'opacity-60' : ''}`}>
            {page.total === 0 ? (
              filtered ? (
                <EmptyState
                  title={t('listing.noMatchTitle')}
                  body={t('listing.noMatchBody')}
                  action={<LinkButton href={clearHref} variant="secondary" render={<RouterLink to={clearHref} />}>{t('listing.clearAll')}</LinkButton>}
                />
              ) : (
                (zero ?? (
                  <EmptyState title={t('listing.emptyTitle')} body={t('listing.emptyBody')} action={<LinkButton href={path('/new')} variant="secondary" render={<RouterLink to={path('/new')} />}>{t('listing.seeNew')}</LinkButton>} />
                ))
              )
            ) : (
              <>
                <ProductGrid items={page.items} density={density} />
                <Pager key={base} shown={page.items.length} total={page.total} next={page.nextCursor} depth={0} base={base} memo={base} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
