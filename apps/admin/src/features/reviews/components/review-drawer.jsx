import { ApiError } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Drawer } from '@noor/ui/drawer'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Skeleton } from '@noor/ui/skeleton'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { HistoryPanel } from '@/components/history-panel'
import { formatDateTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { reviewQueries, useReviewMutations } from '../api'
import { fitLabels, reasonLabel, starsText } from '../labels'
import { RejectDialog } from './reject-dialog'

/** @typedef {import('../api').AdminReview} AdminReview */

/** The status of a review as a chip. @param {{ status: AdminReview['status'] }} props */
export function ReviewStatus({ status }) {
  return <Badge tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{status[0]?.toUpperCase()}{status.slice(1)}</Badge>
}

/** Stars the way a person and a screen reader both get them. @param {{ rating: number }} props */
export function Stars({ rating }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="whitespace-nowrap text-warning">
      {starsText(rating)}
    </span>
  )
}

/** @param {{ review: AdminReview }} props */
function Body({ review }) {
  const can = useCan()
  const toast = useToast()
  const { moderate, reply, removePhoto } = useReviewMutations()
  const [rejecting, setRejecting] = useState(false)
  const [removing, setRemoving] = useState(/** @type {string | null} */ (null))
  const [text, setText] = useState(review.reply?.body ?? '')
  const write = can('reviews:moderate')
  const fail = (/** @type {unknown} */ e) => toast.push({ title: messageFor(e), tone: 'danger' })

  return (
    <div className="space-y-5">
      <section aria-label="Review" className="space-y-2">
        <p className="flex flex-wrap items-center gap-2">
          <Stars rating={review.rating} />
          <ReviewStatus status={review.status} />
          {review.fit ? <span className="text-sm text-muted">{fitLabels[review.fit]}</span> : null}
        </p>
        {review.title ? <h3 className="font-medium">{review.title}</h3> : null}
        <p className="whitespace-pre-wrap break-words text-sm">{review.body}</p>
        <p className="text-xs text-muted">
          {review.displayName} · {formatDateTime(review.createdAt)} · order <AppLink to={`/orders/${review.order.id}`}>{review.order.orderNumber}</AppLink> · <AppLink to={`/products/${review.product.id}`}>{review.product.title}</AppLink>
        </p>
        {review.status === 'rejected' ? (
          <p className="text-sm">
            Rejected: {reasonLabel(review.rejectReason)}
            {review.rejectNote ? `. ${review.rejectNote}` : ''}
          </p>
        ) : null}
        {review.moderatedBy ? <p className="text-xs text-muted">Decided by {review.moderatedBy}{review.moderatedAt ? `, ${formatDateTime(review.moderatedAt)}` : ''}</p> : null}
      </section>

      {review.photos.length ? (
        <section aria-label="Photos" className="space-y-2">
          <h3 className="text-sm font-medium">Photos</h3>
          <ul className="grid grid-cols-3 gap-2">
            {review.photos.map((p) => (
              <li key={p.mediaId} className="space-y-1">
                <a href={p.src} target="_blank" rel="noopener noreferrer" aria-label="Open the photo in full size">
                  <img src={p.src} alt={p.alt || 'Photo from the customer'} width={p.width} height={p.height} className="aspect-square w-full rounded-media object-cover" />
                </a>
                {write ? (
                  <Button size="sm" variant="secondary" fullWidth onClick={() => setRemoving(p.mediaId)}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Check the photos before approving: remove one that shows a face or an address label.</p>
        </section>
      ) : null}

      {write ? (
        <section aria-label="Decision" className="space-y-2">
          <h3 className="text-sm font-medium">Decision</h3>
          <p className="text-xs text-muted">Reject only for the listed reasons. You cannot change the customer's words or stars.</p>
          <div className="flex flex-wrap gap-2">
            {review.status !== 'approved' ? (
              <Button loading={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, body: { status: 'approved' } }, { onSuccess: () => toast.push({ title: 'Review approved', tone: 'success' }), onError: fail })}>
                Approve
              </Button>
            ) : null}
            {review.status !== 'rejected' ? (
              <Button variant="danger" onClick={() => setRejecting(true)}>
                Reject
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-label="Store reply" className="space-y-2">
        <h3 className="text-sm font-medium">Store reply</h3>
        {write ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              reply.mutate({ id: review.id, body: text.trim() }, { onSuccess: () => toast.push({ title: text.trim() ? 'Reply saved' : 'Reply removed', tone: 'success' }), onError: fail })
            }}
          >
            <Field label="Public reply" hint="Shown under the review with the store's name. Polite and specific, and nothing about the customer's order. At most 600 characters.">
              <Textarea rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" loading={reply.isPending} disabled={text.trim() === (review.reply?.body ?? '')}>
              {!text.trim() && review.reply ? 'Remove reply' : 'Save reply'}
            </Button>
          </form>
        ) : review.reply ? (
          <p className="whitespace-pre-wrap text-sm">{review.reply.body}</p>
        ) : (
          <p className="text-sm text-muted">No reply.</p>
        )}
      </section>

      <HistoryPanel entityType="review" entityId={review.id} />

      {rejecting ? (
        <RejectDialog
          title="Reject this review"
          pending={moderate.isPending}
          error={moderate.error ? <p role="alert" className="text-sm text-danger">{messageFor(moderate.error)}</p> : null}
          onClose={() => setRejecting(false)}
          onSubmit={(v) => moderate.mutate({ id: review.id, body: { status: 'rejected', ...v } }, { onSuccess: () => (setRejecting(false), toast.push({ title: 'Review rejected', tone: 'success' })) })}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this photo?"
        body="The photo is taken off the review for good. The rest of the review stays as it is."
        confirmLabel="Remove photo"
        onConfirm={async () => {
          if (!removing) return
          try {
            await removePhoto.mutateAsync({ id: review.id, mediaId: removing })
            toast.push({ title: 'Photo removed', tone: 'success' })
          } catch (e) {
            fail(e)
            throw e
          }
        }}
      />
    </div>
  )
}

/** One review in a side panel, opened by `?review=<id>` (plan/07-admin/08-reviews.md section 3). @param {{ id: string; onClose: () => void }} props */
export function ReviewDrawer({ id, onClose }) {
  const review = useQuery(reviewQueries.detail(id))
  const missing = review.error instanceof ApiError && review.error.code === 'not_found'
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title="Review" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {review.isPending ? <Skeleton className="h-40 w-full" /> : null}
      {review.isError ? <ErrorState title={missing ? 'This review is gone' : 'This review could not be loaded'} retryLabel={missing ? 'Close' : 'Try again'} onRetry={() => (missing ? onClose() : void review.refetch())} /> : null}
      {review.data ? <Body review={review.data} /> : null}
    </Drawer>
  )
}
