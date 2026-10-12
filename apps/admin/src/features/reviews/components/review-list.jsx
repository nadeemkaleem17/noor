import { Button } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppLink } from '@/components/app-link'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { formatDateTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { useListParams } from '@/lib/list-params'
import { useCan } from '@/lib/session'
import { reviewListSchema, reviewQueries, useReviewMutations } from '../api'
import { fitLabels } from '../labels'
import { RejectDialog } from './reject-dialog'
import { ReviewDrawer, ReviewStatus, Stars } from './review-drawer'

/** @typedef {import('../api').AdminReview} Row */

const tabs = /** @type {const} */ ([
  { id: 'pending', label: 'Pending', status: 'pending' },
  { id: 'approved', label: 'Approved', status: 'approved' },
  { id: 'rejected', label: 'Rejected', status: 'rejected' },
  { id: 'all', label: 'All', status: undefined },
])
const DEFAULT = 'pending'

/** The first 140 characters of a text, cut at a word. @param {string} text */
const excerpt = (text) => (text.length <= 140 ? text : `${text.slice(0, 139).replace(/\s+\S*$/, '')}…`)

/** `/reviews` (plan/07-admin/08-reviews.md section 2): the queue, oldest pending first. */
export function ReviewList() {
  const can = useCan()
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const { params } = useListParams(reviewListSchema)
  const { moderate, bulk } = useReviewMutations()
  const [rejecting, setRejecting] = useState(/** @type {{ ids: string[]; resolve?: (o: import('@/components/bulk-bar').BulkOutcome) => void } | null} */ (null))
  const status = /** @type {string | undefined} */ (search.has('status') || search.has('tab') ? params.status : DEFAULT)
  const tab = search.get('tab') === 'all' ? 'all' : (status ?? 'all')

  /** @param {{ id: string; label: string; status: string | undefined }} t */
  const pick = (t) =>
    setSearch((current) => {
      const next = new URLSearchParams(current)
      next.delete('page')
      if (t.status) next.set('status', t.status)
      else next.delete('status')
      if (t.id === 'all') next.set('tab', 'all')
      else next.delete('tab')
      return next
    })

  const open = (/** @type {string | null} */ id) =>
    setSearch((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('review', id)
      else next.delete('review')
      return next
    })

  /** @type {import('@/components/data-table').Column<Row>[]} */
  const columns = [
    {
      id: 'review',
      header: 'Review',
      cell: (r) => (
        <div className="max-w-md">
          <button type="button" className="text-start" onClick={() => open(r.id)} aria-label={`Open the review by ${r.displayName}`}>
            <Stars rating={r.rating} /> <span className="font-medium">{r.title}</span>
            <span className="block text-sm font-normal text-muted">{excerpt(r.body)}</span>
          </button>
          {r.photos.length ? (
            <span className="mt-1 flex gap-1">
              {r.photos.map((p) => (
                <img key={p.mediaId} src={p.src} alt="" width={32} height={32} className="size-8 rounded-control object-cover" />
              ))}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.product.image ? <img src={r.product.image.src} alt="" width={32} height={40} className="h-10 w-8 rounded-control object-cover" /> : null}
          <AppLink to={`/products/${r.product.id}`}>{r.product.title}</AppLink>
        </span>
      ),
    },
    {
      id: 'author',
      header: 'Author',
      cell: (r) => (
        <span>
          {r.displayName}
          <span className="block text-xs">
            <AppLink to={`/orders/${r.order.id}`}>{r.order.orderNumber}</AppLink>
          </span>
        </span>
      ),
    },
    { id: 'fit', header: 'Fit', hideable: true, cell: (r) => (r.fit ? fitLabels[r.fit] : '') },
    { id: 'createdAt', header: 'Submitted', sortable: true, align: 'end', cell: (r) => formatDateTime(r.createdAt) },
    { id: 'status', header: 'Status', cell: (r) => <ReviewStatus status={r.status} /> },
    {
      id: 'decision',
      header: 'Decision',
      cell: (r) =>
        can('reviews:moderate') && r.status === 'pending' ? (
          <span className="flex gap-1">
            <Button size="sm" aria-label={`Approve the review by ${r.displayName}`} onClick={() => moderate.mutate({ id: r.id, body: { status: 'approved' } }, { onSuccess: () => toast.push({ title: 'Review approved', tone: 'success' }), onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) })}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" aria-label={`Reject the review by ${r.displayName}`} onClick={() => setRejecting({ ids: [r.id] })}>
              Reject
            </Button>
          </span>
        ) : null,
    },
  ]

  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    { key: 'rating', label: 'Stars', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'star' : 'stars'}` })) },
    { key: 'hasPhotos', label: 'With photos', type: 'boolean' },
  ]

  return (
    <>
      <PageHeader title="Reviews" description="Customers write a review for what they received. It shows on the shop only when you approve it." />
      <nav aria-label="Review status" className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => pick(t)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm ${tab === t.id ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg hover:bg-line'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <DataTable
        id="reviews"
        label="Reviews"
        searchPlaceholder="Search the text, the product or the order number…"
        schema={reviewListSchema}
        query={(p) => reviewQueries.list({ ...p, ...(search.has('status') || search.has('tab') ? {} : { status: DEFAULT }) })}
        columns={columns}
        filters={filters}
        defaultSort={tab === 'pending' ? 'createdAt' : '-createdAt'}
        rowId={(r) => r.id}
        rowLabel={(r) => `review by ${r.displayName}`}
        bulkActions={[
          { id: 'approve', label: 'Approve', permission: 'reviews:moderate', done: (n) => `${n} approved`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'approve' }) : { cancelled: true }) },
          {
            id: 'reject',
            label: 'Reject',
            permission: 'reviews:moderate',
            destructive: false,
            done: (n) => `${n} rejected`,
            run: (t) => new Promise((resolve) => ('ids' in t ? setRejecting({ ids: t.ids, resolve }) : resolve({ cancelled: true }))),
          },
        ]}
        selectAllMatching={false}
        empty={{ title: tab === 'pending' ? 'Nothing to moderate' : 'No reviews here', body: 'Reviews appear after a customer writes one from the link of a delivered order.' }}
      />
      {search.get('review') ? <ReviewDrawer key={search.get('review')} id={/** @type {string} */ (search.get('review'))} onClose={() => open(null)} /> : null}
      {rejecting ? (
        <RejectDialog
          title={rejecting.ids.length === 1 ? 'Reject this review' : `Reject ${rejecting.ids.length} reviews`}
          withNote={rejecting.ids.length === 1}
          pending={moderate.isPending || bulk.isPending}
          onClose={() => {
            rejecting.resolve?.({ cancelled: true })
            setRejecting(null)
          }}
          onSubmit={async (v) => {
            const ids = rejecting.ids
            try {
              if (ids.length === 1 && !rejecting.resolve) {
                await moderate.mutateAsync({ id: /** @type {string} */ (ids[0]), body: { status: 'rejected', ...v } })
                toast.push({ title: 'Review rejected', tone: 'success' })
              } else {
                const result = await bulk.mutateAsync({ ids, action: 'reject', reason: v.reason })
                rejecting.resolve?.(result)
              }
              setRejecting(null)
            } catch (e) {
              toast.push({ title: messageFor(e), tone: 'danger' })
              rejecting.resolve?.({ cancelled: true })
              setRejecting(null)
            }
          }}
        />
      ) : null}
    </>
  )
}
