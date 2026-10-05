import { formatDate } from '@noor/i18n/format'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { systemQuery } from '../api'

const environments = /** @type {Record<string, string>} */ ({ local: 'Local', ci: 'Test run', staging: 'Staging', production: 'Production' })

/** @param {{ label: string; children: import('react').ReactNode; }} props */
const Row = ({ label, children }) => (
  <div className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0">
    <dt className="text-muted">{label}</dt>
    <dd className="font-medium">{children}</dd>
  </div>
)

/**
 * `/settings/data` (plan/07-admin/11-settings.md section 4). Read-only: what the server reports about itself and its last backup.
 * There is no reset and no delete-all here, by design. The export and import jobs list arrives with the endpoints that make them (orders and customers exports: M4-10).
 */
export function DataPage() {
  const system = useQuery(systemQuery)
  const info = system.data
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
              <Row label="Background jobs waiting">{info.queue.pending}</Row>
              <Row label="Background jobs that failed">{info.queue.dead}</Row>
              {info.queue.oldestPendingAgeSec !== undefined ? <Row label="Oldest waiting job">{Math.ceil(info.queue.oldestPendingAgeSec / 60)} min</Row> : null}
            </dl>
            {info.queue.dead > 0 ? <p className="text-sm text-danger">Some background jobs failed after several tries. Tell the technical team.</p> : null}
          </SectionCard>
          <SectionCard id="exports" title="Exports and imports" description="Products, orders and customers as spreadsheets, and price and stock updates.">
            <p className="text-sm text-muted">Not available yet: these arrive with the orders and customers screens. When they do, each export runs in the background and its download link expires after 24 hours.</p>
          </SectionCard>
        </div>
      ) : null}
    </>
  )
}
