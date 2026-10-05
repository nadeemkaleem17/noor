import { ApiError } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { LoadMore } from '@noor/ui/load-more'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useInfiniteQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { SearchBox } from '@/components/list-filters'
import { actionSentence, entityHref, entityTypeLabel, entityTypes } from '@/lib/audit'
import { formatDateTime, toLocalInput } from '@/lib/dates'
import { useListParams } from '@/lib/list-params'
import { auditListQuery, auditParamsSchema } from '../api'
import { EntryDrawer } from './entry-drawer'

const presets = /** @type {const} */ ([
  { key: undefined, label: 'Everything' },
  { key: 'security', label: 'Security' },
  { key: 'money', label: 'Money' },
])

/** A day from the date box as the start or end of that day in Pakistan time (UTC+5), as an instant. @param {string} day @param {boolean} end */
const dayToInstant = (day, end) => new Date(`${day}T${end ? '23:59:59' : '00:00:00'}+05:00`).toISOString()

/** `/audit` (plan/07-admin/13-audit-log.md). Read-only: nothing here changes an entry. */
export function AuditPage() {
  const { params, set } = useListParams(auditParamsSchema)
  const { entry, ...filters } = params
  const log = useInfiniteQuery(auditListQuery(filters))
  if (log.error instanceof ApiError && log.error.status === 403) throw log.error // the route's own "no access" state
  const items = log.data?.pages.flatMap((p) => p.items) ?? []
  const active = Object.entries(filters).filter(([, v]) => v !== undefined)

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in this admin, newest first. Entries cannot be changed or deleted. Kept 24 months; security and money entries 36." />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant={params.category === p.key ? 'primary' : 'secondary'} aria-pressed={params.category === p.key} onClick={() => set({ category: p.key })}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SearchBox value={params.q} placeholder="Search names, numbers and SKUs…" onSearch={(q) => set({ q }, { replace: true })} />
          <NativeSelect
            aria-label="Kind of thing"
            placeholder="Kind of thing"
            options={entityTypes.map((t) => ({ value: t, label: entityTypeLabel(t) }))}
            value={params.entityType ?? ''}
            onChange={(e) => set({ entityType: e.target.value || undefined, entityId: undefined })}
          />
          <Field label="From">
            <Input type="date" value={params.from ? toLocalInput(params.from).slice(0, 10) : ''} onChange={(e) => set({ from: e.target.value ? dayToInstant(e.target.value, false) : undefined })} />
          </Field>
          <Field label="To">
            <Input type="date" value={params.to ? toLocalInput(params.to).slice(0, 10) : ''} onChange={(e) => set({ to: e.target.value ? dayToInstant(e.target.value, true) : undefined })} />
          </Field>
          {active.length > 0 ? (
            <Button variant="link" onClick={() => set(Object.fromEntries(Object.keys(filters).map((k) => [k, undefined])))}>
              Clear filters
            </Button>
          ) : null}
        </div>
        {params.entityId || params.actorId ? (
          <p className="text-sm text-muted">
            {params.entityId ? `Only one ${entityTypeLabel(params.entityType ?? 'thing').toLowerCase()}. ` : ''}
            {params.actorId ? 'Only one person. ' : ''}
            <Button variant="link" onClick={() => set({ entityId: undefined, actorId: undefined })}>
              Show everyone's
            </Button>
          </p>
        ) : null}
      </div>

      {log.isPending ? <Spinner label="Loading the audit log" /> : null}
      {log.isError ? <ErrorState title="The audit log could not be loaded" retryLabel="Try again" onRetry={() => void log.refetch()} /> : null}
      {log.isSuccess && items.length === 0 ? <EmptyState title="No entries" body={active.length ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'} /> : null}
      {items.length > 0 ? (
        <>
          <Table label="Audit entries">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Summary</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const href = entityHref(e.entityType, e.entityId)
                return (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-sm">
                      <button type="button" className="underline-offset-2 hover:underline" onClick={() => set({ entry: e.id }, { replace: true })} aria-label={`Open entry: ${actionSentence(e.action)}, ${formatDateTime(e.at, true)}`}>
                        {formatDateTime(e.at, true)}
                      </button>
                    </Td>
                    <Td>{e.actorType === 'staff' && e.actorId ? <AppLink to={`/staff/${e.actorId}`}>{e.actorLabel}</AppLink> : <span className="text-muted">{e.actorLabel}</span>}</Td>
                    <Td>
                      {actionSentence(e.action)} {e.category !== 'general' ? <Badge tone={e.category === 'security' ? 'warning' : 'accent'}>{e.category}</Badge> : null}
                    </Td>
                    <Td>
                      <span className="text-muted">{entityTypeLabel(e.entityType)} · </span>
                      {href ? <AppLink to={href}>{e.entityLabel ?? e.entityId ?? 'open'}</AppLink> : (e.entityLabel ?? e.entityId ?? '')}
                    </Td>
                    <Td className="max-w-xs truncate text-sm" title={e.summary}>
                      {e.summary}
                    </Td>
                    <Td className="font-mono text-xs">{e.ip}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          <LoadMore className="mt-4" shown={items.length} total={log.data?.pages[0]?.total ?? items.length} hasMore={Boolean(log.hasNextPage)} loading={log.isFetchingNextPage} onLoadMore={() => void log.fetchNextPage()} />
        </>
      ) : null}
      {entry ? <EntryDrawer id={entry} onClose={() => set({ entry: undefined }, { replace: true })} /> : null}
    </>
  )
}
