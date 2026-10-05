import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { actionSentence, entityHref, entityTypeLabel } from '@/lib/audit'
import { formatDateTime } from '@/lib/dates'
import { auditEntryQuery } from '../api'

const moneyField = /minor$|price|fee|amount|freeabove|compare/i

/**
 * One side of a change. Secrets arrive as "[redacted]" and stay hidden; money fields show rupees with the raw paisa on hover;
 * lists show what was added or removed.
 * @param {{ field: string; value: unknown; other: unknown; }} props
 */
function Value({ field, value, other }) {
  if (value === null || value === undefined) return <span className="text-muted">none</span>
  if (typeof value === 'number' && moneyField.test(field)) return <span title={`${value} paisa`}>{formatMoney({ amount: value, currency: 'PKR' }, 'en')}</span>
  if (Array.isArray(value) && Array.isArray(other) && [...value, ...other].every((v) => typeof v !== 'object')) {
    const gone = value.filter((v) => !other.includes(v))
    return gone.length ? (
      <span className="flex flex-wrap gap-1">
        {gone.map((v) => (
          <span key={String(v)} className="rounded-control bg-surface-2 px-1.5 text-xs">
            {String(v)}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-muted">same</span>
    )
  }
  return <span className="whitespace-pre-wrap break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
}

/** @param {{ label: string; children: import('react').ReactNode; }} props */
const Item = ({ label, children }) => (
  <div>
    <dt className="text-muted">{label}</dt>
    <dd className="break-words">{children}</dd>
  </div>
)

/**
 * The detail of one entry (plan/07-admin/13-audit-log.md section 3): who, when, from where, and only the fields that changed, before and after.
 * @param {{ id: string; onClose: () => void; }} props
 */
export function EntryDrawer({ id, onClose }) {
  const entry = useQuery(auditEntryQuery(id))
  const e = entry.data
  const href = e ? entityHref(e.entityType, e.entityId) : undefined
  const changes = e?.diff ? Object.entries(e.diff) : []
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title={e ? actionSentence(e.action) : 'Entry'} footer={<Button onClick={onClose}>Close</Button>}>
      {entry.isPending ? <Spinner label="Loading entry" /> : null}
      {entry.isError ? <ErrorState title="The entry could not be loaded" retryLabel="Try again" onRetry={() => void entry.refetch()} /> : null}
      {e ? (
        <div className="space-y-5 text-sm">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Item label="When">{formatDateTime(e.at, true)}</Item>
            <Item label="Who">
              {e.actorId ? <AppLink to={`/staff/${e.actorId}`}>{e.actorLabel}</AppLink> : e.actorLabel}
              {e.actorRole ? <span className="text-muted"> ({e.actorRole} then)</span> : null}
            </Item>
            <Item label="What">
              {entityTypeLabel(e.entityType)}
              {e.entityLabel ? ` · ${e.entityLabel}` : ''}
            </Item>
            <Item label="IP address">{e.ip ?? '-'}</Item>
            <Item label="Browser">{e.userAgent ?? '-'}</Item>
            <Item label="Request">
              <span className="font-mono text-xs">{e.requestId ?? '-'}</span>
            </Item>
          </dl>
          {e.reason ? (
            <div>
              <h3 className="font-medium">Reason</h3>
              <p>{e.reason}</p>
            </div>
          ) : null}
          <div>
            <h3 className="mb-2 font-medium">Changes</h3>
            {changes.length === 0 ? (
              <p className="text-muted">No field changes were recorded.</p>
            ) : (
              <Table label="Changes">
                <caption className="sr-only">Changed fields, before and after</caption>
                <thead>
                  <tr>
                    <Th>Field</Th>
                    <Th>Before</Th>
                    <Th>After</Th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(([field, change]) => (
                    <tr key={field}>
                      <Td className="font-mono text-xs">{field}</Td>
                      {change === '[redacted]' ? (
                        <Td colSpan={2} className="text-muted">
                          •••
                        </Td>
                      ) : (
                        <>
                          <Td>
                            <Value field={field} value={change[0]} other={change[1]} />
                          </Td>
                          <Td>
                            <Value field={field} value={change[1]} other={change[0]} />
                          </Td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
          <p className="flex flex-wrap gap-4">
            {href ? <AppLink to={href}>Open {entityTypeLabel(e.entityType).toLowerCase()}</AppLink> : null}
            {e.entityId ? <AppLink to={`/audit?entityType=${encodeURIComponent(e.entityType)}&entityId=${encodeURIComponent(e.entityId)}`}>All activity for this {entityTypeLabel(e.entityType).toLowerCase()}</AppLink> : null}
            {e.actorId ? <AppLink to={`/audit?actorId=${e.actorId}`}>All activity by this person</AppLink> : null}
          </p>
        </div>
      ) : null}
    </Drawer>
  )
}
