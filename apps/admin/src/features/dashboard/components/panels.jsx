import { formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { Card } from '@noor/ui/card'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { relativeTime } from '@/lib/dates'
import { visitSummaryQuery } from '@/lib/sales'
import { dashboardQueries } from '../api'

const rupees = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en', { showDecimals: false, rounding: 'none' })

/** One panel: a title, and its own loading, failure and empty state, so one that fails never blanks the others. @param {{ id: string; title: string; query: { isPending: boolean; isError: boolean; refetch: () => unknown }; empty?: string; isEmpty?: boolean; children: import('react').ReactNode }} props */
function Panel({ id, title, query, empty, isEmpty, children }) {
  return (
    <Card render={<section aria-labelledby={id} />} className="space-y-3">
      <h2 id={id} className="font-heading text-lg font-semibold">
        {title}
      </h2>
      {query.isPending ? <Skeleton className="h-40 w-full" /> : query.isError ? <ErrorState title={`${title} could not be loaded`} retryLabel="Try again" onRetry={() => void query.refetch()} /> : isEmpty ? <p className="text-sm text-muted">{empty}</p> : children}
    </Card>
  )
}

/** The products that sold most in the period. @param {{ from: string; to: string }} props */
export function TopProducts({ from, to }) {
  const q = useQuery(dashboardQueries.top(from, to))
  return (
    <Panel id="top-h" title="Top products" query={q} isEmpty={q.data?.items.length === 0} empty="Nothing sold in this period.">
      <ol className="divide-y divide-line text-sm">
        {q.data?.items.map((p) => (
          <li key={p.productId} className="flex items-center gap-3 py-2">
            {p.image ? <img src={p.image.src} alt="" width={32} height={40} className="h-10 w-8 shrink-0 rounded-control object-cover" /> : <span aria-hidden className="h-10 w-8 shrink-0 rounded-control bg-surface-2" />}
            <AppLink to={`/products/${p.productId}`} className="min-w-0 flex-1 truncate text-fg underline-offset-2 hover:underline">
              {p.title}
            </AppLink>
            <span className="text-muted tabular-nums">{p.units} sold</span>
            <span className="tabular-nums">{rupees(p.sales)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** The last ten orders, newest first. */
export function RecentOrders() {
  const q = useQuery(dashboardQueries.recent())
  const rows = q.data?.items.slice(0, 10) ?? []
  return (
    <Panel id="recent-h" title="Recent orders" query={q} isEmpty={rows.length === 0} empty="No orders yet.">
      <ul className="divide-y divide-line text-sm">
        {rows.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <AppLink to={`/orders/${o.id}`}>{o.orderNumber}</AppLink>
              <span className="ms-2">{o.customerName.split(' ')[0]}</span>
              <span className="ms-2 text-muted">{o.city}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{rupees(o.total)}</span>
              <StatusBadge status={o.status} />
              <span className="text-xs text-muted">{relativeTime(o.placedAt)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** What shoppers looked for and did not find: it says which synonyms or products to add. @param {{ from: string; to: string }} props */
export function ZeroSearches({ from, to }) {
  const q = useQuery(dashboardQueries.zero(from, to))
  return (
    <Panel id="zero-h" title="Searches with no results" query={q} isEmpty={q.data?.items.length === 0} empty="Every search found something.">
      <ul className="divide-y divide-line text-sm">
        {q.data?.items.map((s) => (
          <li key={s.query} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate">{s.query}</span>
            <span className="text-muted tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** Visits to the website, counted without names, and the pages people arrive on (plan/17 item 9). Needs `customers:read`, like the other visit figures. @param {{ from: string; to: string }} props */
export function VisitsPanel({ from, to }) {
  const q = useQuery(visitSummaryQuery({ from, to }))
  const d = q.data
  return (
    <Panel id="visits-h" title="Website visits" query={q} isEmpty={d?.visits === 0} empty="No visits counted in this period. Counting is on under Settings, Store, Features.">
      {d ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Visits', d.visits],
              ['Visitors', d.visitors],
              ['New', d.newVisitors],
              ['Returning', d.returningVisitors],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <dt className="text-muted">{label}</dt>
                <dd className="font-heading text-xl font-semibold tabular-nums">{Number(n).toLocaleString('en')}</dd>
              </div>
            ))}
          </dl>
          {d.topPages.length > 0 ? (
            <>
              <h3 className="mt-3 text-sm font-medium">Pages people arrive on</h3>
              <ul className="divide-y divide-line text-sm">
                {d.topPages.map((p) => (
                  <li key={p.path} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate"><bdi>{p.path}</bdi></span>
                    <span className="text-muted tabular-nums">{p.visits}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </Panel>
  )
}
