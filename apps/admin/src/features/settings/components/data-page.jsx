import { formatDate } from '@noor/i18n/format'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { Button } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useBackgroundStatus } from '@/lib/background'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { searchIndexQuery, systemQuery } from '../api'

const environments = /** @type {Record<string, string>} */ ({ local: 'Local', ci: 'Test run', staging: 'Staging', production: 'Production' })

/** @param {{ label: string; children: import('react').ReactNode; }} props */
const Row = ({ label, children }) => (
  <div className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0">
    <dt className="text-muted">{label}</dt>
    <dd className="font-medium">{children}</dd>
  </div>
)

/** What the search index holds against what the shop sells, with a button to rebuild it (the safe answer to "a product does not show in search"). */
function SearchIndexCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const status = useQuery({ ...searchIndexQuery, refetchInterval: (q) => (q.state.data?.rebuildQueued ? 3000 : false) })
  const rebuild = useMutation({
    mutationFn: () => api('admin.searchIndex.rebuild'),
    onSuccess: () => {
      toast.push({ title: 'Rebuild queued', description: 'The search index is being rebuilt in the background.', tone: 'success' })
      void queryClient.invalidateQueries({ queryKey: searchIndexQuery.queryKey })
    },
    onError: () => toast.push({ title: 'The rebuild could not be started', tone: 'danger' }),
  })
  const s = status.data
  const behind = s ? s.missing + s.stale + s.orphaned : 0
  return (
    <SectionCard id="search-index" title="Search index" description="What customers' searches look through. It updates itself when a product changes; rebuild it if a product does not turn up.">
      {status.isError ? <p role="alert" className="text-sm text-danger">The search index could not be checked.</p> : null}
      {s ? (
        <>
          <dl className="text-sm">
            <Row label="Products for sale">{s.active}</Row>
            <Row label="Products in the search index">{s.indexed}</Row>
            <Row label="Missing from the index">{s.missing}</Row>
            <Row label="Out of date in the index">{s.stale}</Row>
            <Row label="Left over (no longer for sale)">{s.orphaned}</Row>
            {s.lastIndexedAt ? <Row label="Last updated">{formatDate(s.lastIndexedAt, 'en')}</Row> : null}
          </dl>
          <p role="status" className={`text-sm ${behind ? 'text-warning' : 'text-success'}`}>
            {s.rebuildQueued ? 'A rebuild is waiting for the background worker.' : behind ? 'The index is behind. It repairs itself every ten minutes, or rebuild it now.' : 'The index is complete and up to date.'}
          </p>
          <div>
            <Button variant="secondary" loading={rebuild.isPending} disabled={s.rebuildQueued} onClick={() => rebuild.mutate()}>
              Rebuild the search index
            </Button>
          </div>
        </>
      ) : status.isPending ? (
        <Spinner label="Checking the search index" />
      ) : null}
    </SectionCard>
  )
}

/**
 * `/settings/data` (plan/07-admin/11-settings.md section 4). Read-only: what the server reports about itself and its last backup.
 * There is no reset and no delete-all here, by design. The export and import jobs list arrives with the endpoints that make them (orders and customers exports: M4-10).
 */
export function DataPage() {
  const system = useQuery(systemQuery)
  const info = system.data
  const background = useBackgroundStatus()
  return (
    <>
      <PageHeader title="Data" description="Backups, the background queue and the version this shop runs." />
      {system.isPending ? <Spinner label="Loading system information" /> : null}
      {system.isError ? <ErrorState title="System information could not be loaded" retryLabel="Try again" onRetry={() => void system.refetch()} /> : null}
      {info ? (
        <div className="space-y-6">
          <SectionCard id="backups" title="Backups" description="The database is backed up by the server. Restoring is done by the technical team, not from here.">
            <p role="status" className="text-sm">
              {info.lastBackupAt ? (
                <>
                  Last successful backup: <strong>{formatDate(info.lastBackupAt, 'en')}</strong>
                </>
              ) : (
                'No backup has been reported yet.'
              )}
            </p>
          </SectionCard>
          <SectionCard id="system" title="System">
            <dl className="text-sm">
              <Row label="Environment">{environments[info.environment] ?? info.environment}</Row>
              <Row label="Version">{info.version}</Row>
              {background ? <Row label="Background worker">{background.workers > 0 ? `Running (${background.workers})` : 'Not running'}</Row> : null}
              <Row label="Background jobs waiting">{info.queue.pending}</Row>
              <Row label="Background jobs that failed">{info.queue.dead}</Row>
              {info.queue.oldestPendingAgeSec !== undefined ? <Row label="Oldest waiting job">{Math.ceil(info.queue.oldestPendingAgeSec / 60)} min</Row> : null}
            </dl>
            {info.queue.dead > 0 ? <p className="text-sm text-danger">Some background jobs failed after several tries. Tell the technical team.</p> : null}
          </SectionCard>
          <SearchIndexCard />
          <SectionCard id="exports" title="Exports and imports" description="Products, orders and customers as spreadsheets, and price and stock updates.">
            <p className="text-sm text-muted">Not available yet: these arrive with the orders and customers screens. When they do, each export runs in the background and its download link expires after 24 hours.</p>
          </SectionCard>
        </div>
      ) : null}
    </>
  )
}
