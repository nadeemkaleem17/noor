import { ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Table, Td, Th } from '@noor/ui/table'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { messageFor } from '@/lib/errors'
import { AppLink } from './app-link'

/**
 * What a bulk action sends and gets back (plan/07-admin/14-tables-bulk.md section 5; the wire shape is plan/10-api/00 section 10).
 * @typedef {{ ids: string[]; } | { filter: Record<string, unknown>; expectedTotal: number; }} BulkTarget
 * @typedef {{ succeeded: string[]; failed: { id: string; code: string; detail?: string; }[]; }} BulkResult
 * @typedef {BulkResult | { jobId: string; } | { download: { filename: string; blob: Blob; }; } | { cancelled: true; }} BulkOutcome
 * @typedef {object} BulkAction
 * @property {string} id
 * @property {string} label
 * @property {import('@noor/contract').Permission} [permission] - the action is not shown without it
 * @property {boolean} [destructive] - asks for confirmation; more than 20 items ask for the count to be typed
 * @property {(n: number) => string} [done] - "3 published"
 * @property {(target: BulkTarget) => Promise<BulkOutcome>} run - one request for the whole selection
 */

/** What a background job reports (plan/10-api/08 section 4). @typedef {{ state: 'queued' | 'running' | 'done' | 'failed'; result?: BulkResult | { exportId: string; }; error?: string; }} JobStatus */

/**
 * The bar that replaces the filters while rows are selected.
 * @param {{ count: number; allMatching: boolean; actions: BulkAction[]; onRun: (action: BulkAction) => void; onClear: () => void; }} props
 */
export function BulkBar({ count, allMatching, actions, onRun, onClear }) {
  return (
    <div role="toolbar" aria-label="Bulk actions" className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-card border border-line bg-accent-soft px-3 py-2">
      <p className="me-2 text-sm font-medium" aria-live="polite">
        {count.toLocaleString('en')} selected{allMatching ? ' (all matching the filters)' : ''}
      </p>
      {actions.map((a) => (
        <Button key={a.id} size="sm" variant={a.destructive ? 'danger' : 'secondary'} onClick={() => onRun(a)}>
          {a.label}
        </Button>
      ))}
      <Button size="sm" variant="ghost" className="ms-auto" iconStart={<X aria-hidden className="size-4" />} onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}

/**
 * Watches one background job until it ends, polling every 2 s (plan/10-api/08: `admin.jobs.get`). It renders nothing.
 * @param {{ jobId: string; getJob: (id: string) => Promise<JobStatus>; onEnd: (status: JobStatus) => void; }} props
 */
export function JobWatcher({ jobId, getJob, onEnd }) {
  useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const status = await getJob(jobId)
      if (status.state === 'done' || status.state === 'failed') onEnd(status)
      return status
    },
    refetchInterval: (query) => (query.state.data && (query.state.data.state === 'done' || query.state.data.state === 'failed') ? false : 2000),
    gcTime: 0,
  })
  return null
}

/**
 * The items an action could not handle, with the reason of each (all failed, or "View failures" after a mixed result).
 * @param {{ failures: { label: string; href?: string; reason: string; }[] | null; onClose: () => void; }} props
 */
export function FailuresDialog({ failures, onClose }) {
  return (
    <Dialog
      open={failures !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Some items failed"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText((failures ?? []).map((f) => `${f.label}: ${f.reason}`).join('\n'))}>
            Copy list
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <Table label="Items that failed">
        <thead>
          <tr>
            <Th>Item</Th>
            <Th>Reason</Th>
          </tr>
        </thead>
        <tbody>
          {(failures ?? []).map((f) => (
            <tr key={f.label}>
              <Td>{f.href ? <AppLink to={f.href}>{f.label}</AppLink> : f.label}</Td>
              <Td>{f.reason}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Dialog>
  )
}

/** The sentence for one failed item: the server's detail, else the message of its code. @param {{ code: string; detail?: string; }} failed */
export const failureReason = (failed) => failed.detail ?? messageFor(new ApiError(/** @type {import('@noor/contract').ErrorCode} */ (failed.code), 0))
