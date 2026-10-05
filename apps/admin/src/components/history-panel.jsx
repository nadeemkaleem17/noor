import { Card } from '@noor/ui/card'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { actionSentence } from '@/lib/audit'
import { formatDateTime } from '@/lib/dates'
import { useCan } from '@/lib/session'
import { AppLink } from './app-link'

/**
 * The newest 10 audit entries of one thing, collapsed until opened (plan/07-admin/13-audit-log.md section 4). Nothing at all without `audit:read`.
 * @param {{ entityType: string; entityId: string; }} props
 */
export function HistoryPanel({ entityType, entityId }) {
  const can = useCan()
  const [open, setOpen] = useState(false)
  const allowed = can('audit:read')
  const history = useQuery({
    queryKey: ['audit', 'history', entityType, entityId],
    queryFn: ({ signal }) => api('admin.audit.list', { query: { entityType, entityId, limit: 10 }, signal }),
    enabled: allowed && open,
  })
  if (!allowed) return null
  const items = history.data?.items ?? []
  return (
    <Card padding="lg" className="mt-6 max-w-3xl">
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer font-heading text-lg font-semibold">History</summary>
        <div className="mt-3 space-y-2 text-sm">
          {history.isPending && open ? <p className="text-muted">Loading history…</p> : null}
          {history.isError ? <p className="text-danger">The history could not be loaded.</p> : null}
          {history.isSuccess && items.length === 0 ? <p className="text-muted">Nothing has been recorded yet.</p> : null}
          <ul className="space-y-2">
            {items.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{e.actorLabel}</span> {actionSentence(e.action)}
                <span className="block text-xs text-muted">
                  {formatDateTime(e.at, true)}
                  {e.summary ? ` · ${e.summary}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <AppLink to={`/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`} className="inline-block underline">
            View all
          </AppLink>
        </div>
      </details>
    </Card>
  )
}
