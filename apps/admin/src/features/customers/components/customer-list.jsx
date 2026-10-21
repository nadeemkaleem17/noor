import { formatDate, formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button, LinkButton } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/dates'
import { downloadBlob } from '@/lib/download'
import { messageFor } from '@/lib/errors'
import { parseListParams } from '@/lib/list-params'
import { useCan } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { orderLookupsQuery } from '@/lib/sales'
import { customerListSchema, customerQueries, highlightRulesQuery } from '../api'
import { HighlightBadges } from './highlight-badges'
import { VisitStrip } from './visit-strip'

/** @typedef {import('../api').CustomerRow} Row */

/** The flags of a customer as chips. @param {{ c: Pick<Row, 'noCod' | 'vip' | 'marketingConsent'> }} props */
export function Flags({ c }) {
  return (
    <span className="flex flex-wrap gap-1">
      {c.noCod ? <Badge tone="danger">No COD</Badge> : null}
      {c.vip ? <Badge tone="accent">VIP</Badge> : null}
      {c.marketingConsent ? <Badge>Marketing OK</Badge> : null}
    </span>
  )
}

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  {
    id: 'name',
    header: 'Customer',
    sortable: true,
    cell: (c) => (
      <span>
        {c.name} <HighlightBadges highlights={c.highlights} />
        <span className="block text-xs font-normal text-muted" dir="ltr">
          {c.phone}
        </span>
        {c.email ? <span className="block text-xs font-normal text-muted" dir="ltr">{c.email}</span> : null}
      </span>
    ),
  },
  { id: 'registeredAt', header: 'Registered', align: 'end', cell: (c) => (c.registeredAt ? formatDate(c.registeredAt, 'en', { dateStyle: 'medium' }) : <span className="text-muted">Guest</span>) },
  { id: 'createdAt', header: 'Customer since', sortable: true, align: 'end', cell: (c) => formatDate(c.createdAt, 'en', { dateStyle: 'medium' }) },
  { id: 'city', header: 'City', sortable: true, cell: (c) => c.city ?? '' },
  { id: 'ordersCount', header: 'Orders', sortable: true, align: 'end', cell: (c) => c.ordersCount },
  { id: 'delivered', header: 'Delivered', align: 'end', cell: (c) => c.deliveredCount },
  { id: 'refusedCount', header: 'Refused / returned', sortable: true, align: 'end', cell: (c) => (c.refusedCount > 0 ? <Badge tone="danger">{c.refusedCount}</Badge> : 0) },
  { id: 'spent', header: 'Spent', sortable: true, align: 'end', cell: (c) => formatMoney(c.spent, 'en') },
  { id: 'lastOrderAt', header: 'Last order', sortable: true, align: 'end', cell: (c) => (c.lastOrderAt ? relativeTime(c.lastOrderAt) : '') },
  { id: 'visitsCount', header: 'Visits', sortable: true, align: 'end', cell: (c) => (c.visitsCount > 0 ? c.visitsCount : <span className="text-muted">0</span>) },
  { id: 'lastVisitAt', header: 'Last visit', align: 'end', cell: (c) => (c.lastVisitAt ? relativeTime(c.lastVisitAt) : '') },
  { id: 'flags', header: 'Flags', cell: (c) => <Flags c={c} /> },
]

/** `/customers` (plan/07-admin/06-customers.md section 2). */
export function CustomerList() {
  const can = useCan()
  const toast = useToast()
  const [search] = useSearchParams()
  const { run, dialog } = useStepUp()
  const [busy, setBusy] = useState(false)
  // the city names come with the order screens' lookups: a role that cannot read orders has no city filter
  const lookups = useQuery({ ...orderLookupsQuery, enabled: can('orders:read') })
  const rules = useQuery(highlightRulesQuery)

  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    ...(lookups.data ? [/** @type {const} */ ({ key: 'cityName', label: 'City', type: 'select', options: lookups.data.cities.map((c) => ({ value: c.name, label: c.name })) })] : []),
    { key: 'flag', label: 'Flag', type: 'select', options: [{ value: 'no_cod', label: 'No COD' }, { value: 'vip', label: 'VIP' }, { value: 'consent', label: 'Marketing consent' }] },
    { key: 'hasRefusals', label: 'Has refusals', type: 'boolean' },
    { key: 'registered', label: 'Registered only', type: 'boolean' },
    { key: 'minVisits', label: 'Visits', type: 'select', options: [2, 3, 5, 10, 20].map((n) => ({ value: String(n), label: `${n} or more visits` })) },
    ...(rules.data?.items.length ? [/** @type {const} */ ({ key: 'rule', label: 'Highlight', type: 'select', options: rules.data.items.map((r) => ({ value: r.id, label: `${r.label}${r.enabled ? '' : ' (off)'}` })) })] : []),
  ]

  async function exportCsv() {
    setBusy(true)
    try {
      const filter = Object.fromEntries(Object.entries(/** @type {Record<string, unknown>} */ (parseListParams(customerListSchema, search))).filter(([k]) => !['page', 'size', 'sort'].includes(k)))
      const file = await run(() => api('admin.customers.export', { body: /** @type {never} */ (filter) }))
      downloadBlob(file.filename, new Blob([file.csv], { type: 'text/csv;charset=utf-8' }))
      toast.push({ title: `${file.rowCount} customers exported`, tone: 'success' })
    } catch (e) {
      if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="One record per phone number. Customers have no login. Visits are counted per browser and kept apart from orders."
        actions={
          <>
            <LinkButton variant="secondary" href="/customers/highlights" render={<RouterLink to="/customers/highlights" />}>
              Highlight rules
            </LinkButton>
            {can('customers:export') ? (
              <Button variant="secondary" loading={busy} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            ) : null}
          </>
        }
      />
      <VisitStrip />
      <DataTable
        id="customers"
        label="Customers"
        searchPlaceholder="Search name, phone or email…"
        schema={customerListSchema}
        query={customerQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="-lastOrderAt"
        rowId={(c) => c.id}
        rowLabel={(c) => c.name}
        rowHref={(c) => `/customers/${c.id}`}
        empty={{ title: 'No customers yet', body: 'A customer appears here with their first order.' }}
      />
      {dialog}
    </>
  )
}
