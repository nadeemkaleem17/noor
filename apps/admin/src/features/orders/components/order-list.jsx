import { enums } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { Badge, StatusBadge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, MessageCircle, Printer } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AppLink } from '@/components/app-link'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { formatDateTime } from '@/lib/dates'
import { useListParams } from '@/lib/list-params'
import { useCan } from '@/lib/session'
import { orderListSchema, orderQueries } from '../api'
import { ageText, ageTone, isWholePhone, waLink } from '../format'
import { humanise } from '../labels'
import { BulkOrderDialog } from './bulk-order-dialog'
import { ExportDialog } from './export-dialog'
import { RiskChips } from './risk-chips'

/** @typedef {import('../api').OrderRow} Row */

/** Every status in the address: the "All" tab. The address without a status is the "To confirm" tab, the one staff start from. */
const ALL = enums.orderStatus.join(',')
const DEFAULT_STATUS = 'pending_confirmation'

/** The tabs of plan/07-admin/05-orders.md section 2: what each one lists, and the statuses whose counts add up to its number. */
const tabs = [
  { id: 'confirm', label: 'To confirm', status: 'pending_confirmation', count: ['pending_confirmation'] },
  { id: 'dispatch', label: 'To dispatch', status: 'confirmed', count: ['confirmed'] },
  { id: 'dispatched', label: 'Dispatched', status: 'dispatched', count: ['dispatched'] },
  { id: 'delivered', label: 'Delivered', status: 'delivered', count: ['delivered'] },
  { id: 'closed', label: 'Cancelled / returned', status: 'cancelled,returned', count: ['cancelled', 'returned'] },
  { id: 'all', label: 'All', status: ALL, count: enums.orderStatus },
]
/** Only shown while some order waits for a prepaid payment. */
const awaiting = { id: 'pending', label: 'Awaiting payment', status: 'pending', count: ['pending'] }

/** @param {Row} o */
const waitSince = (o) => o.statusChangedAt

/** The phone with a button that copies it. @param {{ phone: string }} props */
function Phone({ phone }) {
  const toast = useToast()
  return (
    <span className="inline-flex items-center gap-1" dir="ltr">
      {phone}
      {isWholePhone(phone) ? (
        <IconButton
          size="sm"
          label={`Copy ${phone}`}
          icon={<Copy aria-hidden className="size-3.5" />}
          onClick={() => void navigator.clipboard?.writeText(phone).then(() => toast.push({ title: 'Number copied', tone: 'success' }))}
        />
      ) : null}
    </span>
  )
}

/** @param {{ o: Row }} props */
function StatusCell({ o }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <StatusBadge status={o.status} />
      {o.paymentMethod !== 'cod' ? <StatusBadge status={o.paymentStatus} /> : null}
    </span>
  )
}

/** @param {{ o: Row }} props */
function Age({ o }) {
  const tone = ageTone(o.status, waitSince(o))
  return <Badge tone={tone}>{ageText(waitSince(o))}</Badge>
}

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  {
    id: 'placedAt',
    header: 'Order',
    sortable: true,
    cell: (o) => (
      <span>
        {o.orderNumber}
        <span className="block text-xs font-normal text-muted" title={formatDateTime(o.placedAt)}>
          {ageText(o.placedAt)} ago
        </span>
      </span>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: (o) => (
      <span>
        {o.customerName}
        <span className="block text-xs text-muted">
          <Phone phone={o.customerPhone} />
        </span>
        <RiskChips markers={o.riskMarkers} />
      </span>
    ),
  },
  { id: 'city', header: 'City', sortable: true, cell: (o) => o.city },
  {
    id: 'items',
    header: 'Items',
    cell: (o) => (
      <span>
        {o.itemCount === 1 ? '1 item' : `${o.itemCount} items`}
        <span className="block max-w-48 truncate text-xs text-muted">{o.firstItemTitle}</span>
      </span>
    ),
  },
  {
    id: 'total',
    header: 'Total',
    sortable: true,
    align: 'end',
    cell: (o) => (
      <span>
        {formatMoney(o.total, 'en')}
        <span className="block text-xs text-muted">{o.paymentMethod === 'cod' ? 'Cash on delivery' : humanise(o.paymentMethod)}</span>
      </span>
    ),
  },
  { id: 'status', header: 'Status', cell: (o) => <StatusCell o={o} /> },
  { id: 'statusAge', header: 'Age', sortable: true, align: 'end', cell: (o) => <Age o={o} /> },
]

/** One order as a card, for a phone (plan/07-admin/05-orders.md section 2). @param {Row} o @param {{ selected: boolean; onSelect: (on: boolean) => void } | null} selection */
function renderCard(o, selection) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <AppLink to={`/orders/${o.id}`} className="font-medium text-fg underline-offset-2 hover:underline">
            {o.orderNumber}
          </AppLink>
          <p className="truncate text-sm">{o.customerName}</p>
          <p className="text-xs text-muted">
            <Phone phone={o.customerPhone} /> · {o.city}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusCell o={o} />
          <Age o={o} />
        </div>
      </div>
      <RiskChips markers={o.riskMarkers} />
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <span>{formatMoney(o.total, 'en')}</span>
        {selection ? (
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={selection.selected} onChange={(e) => selection.onSelect(e.target.checked)} />
            <span className="sr-only">Select {o.orderNumber}</span>
            Select
          </label>
        ) : null}
      </div>
    </div>
  )
}

/** `/orders` (plan/07-admin/05-orders.md section 2). */
export function OrderList() {
  const can = useCan()
  const navigate = useNavigate()
  const { params, set } = useListParams(orderListSchema)
  const counts = useQuery(orderQueries.counts())
  const lookups = useQuery(orderQueries.lookups())
  const [bulk, setBulk] = useState(/** @type {{ kind: 'confirm' | 'dispatch' | 'deliver'; ids: string[]; resolve: (o: import('@/components/bulk-bar').BulkOutcome) => void } | null} */ (null))
  const [exporting, setExporting] = useState(false)

  const status = /** @type {string[]} */ (params.status ?? [DEFAULT_STATUS]).join(',')
  const waiting = status === 'pending_confirmation' || status === 'confirmed'
  const shownTabs = counts.data && (counts.data.pending > 0 || status === 'pending') ? [...tabs, awaiting] : tabs

  /** @param {import('@/components/bulk-bar').BulkTarget} target @param {'confirm' | 'dispatch' | 'deliver'} kind @returns {Promise<import('@/components/bulk-bar').BulkOutcome>} */
  const ask = (target, kind) => new Promise((resolve) => (('ids' in target) ? setBulk({ kind, ids: target.ids, resolve }) : resolve({ cancelled: true })))

  /** @type {import('@/components/bulk-bar').BulkAction[]} */
  const bulkActions = [
    { id: 'confirm', label: 'Confirm', permission: 'orders:confirm', done: (n) => `${n} confirmed`, run: (t) => ask(t, 'confirm') },
    { id: 'dispatch', label: 'Mark dispatched', permission: 'orders:dispatch', done: (n) => `${n} dispatched`, run: (t) => ask(t, 'dispatch') },
    { id: 'deliver', label: 'Mark delivered', permission: 'orders:deliver', done: (n) => `${n} delivered`, run: (t) => ask(t, 'deliver') },
    {
      id: 'print',
      label: 'Print invoices',
      run: async (t) => {
        if ('ids' in t) window.open(`/orders/print?ids=${t.ids.join(',')}`, '_blank', 'noopener')
        return { cancelled: true }
      },
    },
  ]

  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    ...(lookups.data ? [/** @type {const} */ ({ key: 'cityId', label: 'City', type: 'select', options: lookups.data.cities.map((c) => ({ value: c.id, label: c.name })) })] : []),
    { key: 'paymentMethod', label: 'Payment', type: 'select', options: enums.paymentMethod.map((v) => ({ value: v, label: v === 'cod' ? 'Cash on delivery' : humanise(v) })) },
    { key: 'paymentStatus', label: 'Payment status', type: 'select', options: enums.paymentStatus.map((v) => ({ value: v, label: humanise(v) })) },
    ...(lookups.data ? [/** @type {const} */ ({ key: 'courierId', label: 'Courier', type: 'select', options: lookups.data.couriers.map((c) => ({ value: c.id, label: c.name })) })] : []),
    { key: 'placed', label: 'Placed', type: 'dateRange', fromKey: 'from', toKey: 'to' },
    { key: 'hasDeposit', label: 'Has deposit', type: 'boolean' },
  ]

  /** @param {Row} o */
  const rowActions = (o) => [
    { label: 'Open', icon: <ExternalLink aria-hidden className="size-4" />, onSelect: () => void navigate(`/orders/${o.id}`) },
    { label: 'Print invoice', icon: <Printer aria-hidden className="size-4" />, onSelect: () => window.open(`/orders/${o.id}/print`, '_blank', 'noopener') },
    ...(waLink(o.customerPhone) ? [{ label: 'WhatsApp customer', icon: <MessageCircle aria-hidden className="size-4" />, onSelect: () => window.open(waLink(o.customerPhone), '_blank', 'noopener') }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            {can('orders:export') ? (
              <Button variant="secondary" onClick={() => setExporting(true)}>
                Export CSV
              </Button>
            ) : null}
            {can('orders:edit') ? <Button onClick={() => void navigate('/orders/new')}>New order</Button> : null}
          </>
        }
      />
      <nav aria-label="Order status" className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {shownTabs.map((t) => {
          const n = counts.data ? t.count.reduce((sum, s) => sum + (counts.data?.[/** @type {keyof typeof counts.data} */ (s)] ?? 0), 0) : undefined
          const active = status === t.status
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => set({ status: t.status === DEFAULT_STATUS ? undefined : t.status.split(',') })}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm ${active ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg hover:bg-line'}`}
            >
              {t.label}
              {n !== undefined ? <span className={active ? 'opacity-80' : 'text-muted'}>{n}</span> : null}
            </button>
          )
        })}
      </nav>
      <DataTable
        id="orders"
        label="Orders"
        searchPlaceholder="Search number, name, phone, tracking number or SKU…"
        schema={orderListSchema}
        query={(p) => orderQueries.list({ ...p, status: p.status ?? [DEFAULT_STATUS] })}
        columns={columns}
        filters={filters}
        defaultSort={waiting ? 'placedAt' : '-placedAt'}
        rowId={(o) => o.id}
        rowLabel={(o) => o.orderNumber}
        rowHref={(o) => `/orders/${o.id}`}
        rowActions={rowActions}
        bulkActions={bulkActions}
        selectAllMatching={false}
        renderCard={renderCard}
        empty={{ title: 'No orders here', body: 'Orders appear here as customers place them.' }}
      />
      <BulkOrderDialog request={bulk} onClose={() => setBulk(null)} />
      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
    </>
  )
}
