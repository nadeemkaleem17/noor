import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { relativeTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { trashQuery, useTrashMutations } from '../api'

/** @typedef {import('@noor/contract').TrashItem} Item */

const kindText = /** @type {Record<string, string>} */ ({ product: 'Product', category: 'Category', attribute: 'Attribute', collection: 'Collection', promo: 'Promo code', page: 'Page' })

/** Whole days left, at least 1 while it is still there. @param {string} expiresAt */
const daysLeft = (expiresAt) => Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))

/**
 * `/trash` (plan/17-owner-requests-2026-10.md item 6): what was deleted in the last 30 days. Put back makes the record again from the copy, by the rules of making a new one, and says why when it
 * cannot (a name taken since, a category that is gone). Delete now empties one for good.
 */
export function TrashPage() {
  const toast = useToast()
  const list = useQuery(trashQuery)
  const { restore, purge } = useTrashMutations()
  const [problems, setProblems] = useState(/** @type {Record<string, string>} */ ({}))
  const [emptying, setEmptying] = useState(/** @type {Item | null} */ (null))

  /** @param {Item} item */
  async function putBack(item) {
    setProblems((p) => Object.fromEntries(Object.entries(p).filter(([id]) => id !== item.id)))
    try {
      await restore.mutateAsync(item.id)
      toast.push({ title: `${item.label} is back${item.kind === 'product' ? ' as a draft' : ''}`, tone: 'success' })
    } catch (e) {
      setProblems((p) => ({ ...p, [item.id]: messageFor(e) }))
    }
  }

  return (
    <>
      <PageHeader title="Trash" description="What was deleted in the last 30 days. Put it back, or delete it for good. After 30 days a copy is removed by itself." />
      {list.isPending ? <Skeleton className="h-40 w-full" /> : null}
      {list.isError ? <ErrorState title="The trash could not be loaded" retryLabel="Try again" onRetry={() => void list.refetch()} /> : null}
      {list.isSuccess && list.data.items.length === 0 ? <EmptyState title="The trash is empty" body="Products, categories, attributes, collections, promo codes and pages you delete wait here for 30 days." /> : null}
      {list.isSuccess && list.data.items.length > 0 ? (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {list.data.items.map((item) => (
            <li key={item.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-sm text-muted">
                    {kindText[item.kind]} · deleted {relativeTime(item.deletedAt)}{item.deletedBy ? ` by ${item.deletedBy}` : ''} · kept {daysLeft(item.expiresAt)} more {daysLeft(item.expiresAt) === 1 ? 'day' : 'days'}
                  </span>
                </span>
                <Button size="sm" loading={restore.isPending && restore.variables === item.id} onClick={() => void putBack(item)}>
                  Put back
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEmptying(item)}>
                  Delete now
                </Button>
              </div>
              {problems[item.id] ? <p role="alert" className="mt-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">It could not be put back: {problems[item.id]}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={emptying !== null}
        onOpenChange={(open) => !open && setEmptying(null)}
        title={`Delete ${emptying?.label ?? ''} for good?`}
        body="Its copy is removed and it can no longer be put back."
        confirmLabel="Delete for good"
        tone="danger"
        onConfirm={async () => {
          const target = emptying
          if (!target) return
          try {
            await purge.mutateAsync(target.id)
            toast.push({ title: 'Deleted for good', tone: 'success' })
          } catch (e) {
            toast.push({ title: messageFor(e), tone: 'danger' })
          }
        }}
      />
    </>
  )
}
