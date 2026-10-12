import { ApiError, enums } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Copy, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { formatDateTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { promoListSchema, promoQueries, usePromoMutations } from '../api'
import { emptyForm, toForm } from '../promo-form'
import { PromoDrawer } from './promo-drawer'

/** @typedef {import('../api').AdminPromo} Row */
/** @typedef {import('../promo-form').PromoForm} PromoForm */

const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en')

/** The status as a chip: it is worked out by the server from the switch and the dates. @param {{ status: Row['status'] }} props */
function PromoStatus({ status }) {
  const tone = /** @type {const} */ ({ active: 'success', scheduled: 'warning', expired: 'neutral', disabled: 'neutral' })[status]
  return <Badge tone={tone}>{status[0]?.toUpperCase()}{status.slice(1)}</Badge>
}

/** @param {Row} p */
const valueText = (p) => (p.type === 'percent' ? `${p.percent}% off` : p.type === 'fixed' && p.amount ? `${money(p.amount)} off` : 'Free delivery')

/** @param {Row} p */
function conditions(p) {
  const scope = p.scope === 'all' ? 'Everything' : p.targets.length <= 2 ? p.targets.map((t) => t.label).join(', ') : `${p.targets.length} ${p.scope}`
  return [scope, p.minSpend ? `min ${money(p.minSpend)}` : '', p.firstOrderOnly ? 'first order' : ''].filter(Boolean).join(' · ')
}

/** The orders that used the code, from the order list with every status. @param {string} code */
const usedHref = (code) => `/orders?promo=${encodeURIComponent(code)}&status=${enums.orderStatus.join(',')}`

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  { id: 'code', header: 'Code', sortable: true, cell: (p) => <span className="font-mono" dir="ltr">{p.code}</span> },
  { id: 'value', header: 'Kind', cell: (p) => valueText(p) },
  { id: 'conditions', header: 'Conditions', cell: (p) => <span className="block max-w-64 truncate text-sm" title={p.summary}>{conditions(p)}</span> },
  {
    id: 'usageCount',
    header: 'Used',
    sortable: true,
    align: 'end',
    cell: (p) =>
      p.usageCount > 0 ? <AppLink to={usedHref(p.code)}>{p.usageLimit ? `${p.usageCount} / ${p.usageLimit}` : p.usageCount}</AppLink> : p.usageLimit ? `0 / ${p.usageLimit}` : '0',
  },
  { id: 'window', header: 'Window', cell: (p) => (p.startsAt || p.endsAt ? `${p.startsAt ? formatDateTime(p.startsAt) : 'Now'} – ${p.endsAt ? formatDateTime(p.endsAt) : 'no end'}` : 'Always') },
  { id: 'status', header: 'Status', cell: (p) => <PromoStatus status={p.status} /> },
]

/** The drawer of one promo: the stored one is read first, so a link to `?edit=<id>` works after a reload. @param {{ id: string; onClose: () => void }} props */
function EditDrawer({ id, onClose }) {
  const promo = useQuery(promoQueries.detail(id))
  if (promo.isPending) return <Skeleton className="h-8 w-48" />
  if (promo.isError) return <ErrorState title="This code could not be loaded" retryLabel="Close" onRetry={onClose} />
  return <PromoDrawer key={promo.data.id} promo={promo.data} seed={null} onClose={onClose} />
}

/** `/promos` (plan/07-admin/07-promos.md). */
export function PromoList() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove, bulk } = usePromoMutations()
  const [deleting, setDeleting] = useState(/** @type {Row | null} */ (null))
  const [seed, setSeed] = useState(/** @type {PromoForm | null} */ (null))

  /** @param {Row} p @param {'enable' | 'disable'} action */
  const toggle = (p, action) => bulk.mutate({ ids: [p.id], action }, { onSuccess: () => toast.push({ title: `${p.code} ${action === 'enable' ? 'switched on' : 'switched off'}`, tone: 'success' }), onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) })

  /** @param {Row} p */
  const rowActions = (p) => [
    ...(can('promos:write')
      ? [
          { label: 'Edit', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(p.id) },
          // a copy keeps the rule and starts with no code, no uses and a fresh window
          { label: 'Duplicate', icon: <Copy aria-hidden className="size-4" />, onSelect: () => (setSeed({ ...toForm(p), code: '', startsAt: '', endsAt: '' }), drawer.create()) },
          p.enabled
            ? { label: 'Switch off', icon: <PowerOff aria-hidden className="size-4" />, onSelect: () => toggle(p, 'disable') }
            : { label: 'Switch on', icon: <Power aria-hidden className="size-4" />, onSelect: () => toggle(p, 'enable') },
        ]
      : []),
    ...(can('promos:delete') ? [{ label: p.used ? 'Delete (used: switch off instead)' : 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), disabled: p.used, onSelect: () => setDeleting(p) }] : []),
  ]

  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'scheduled', 'expired', 'disabled'].map((v) => ({ value: v, label: v[0]?.toUpperCase() + v.slice(1) })) },
    { key: 'type', label: 'Kind', type: 'select', options: [{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'free_shipping', label: 'Free delivery' }] },
  ]

  return (
    <>
      <PageHeader
        title="Promo codes"
        description="One code per cart. A code changes the price of future orders only."
        actions={
          can('promos:write') ? (
            <Button
              onClick={() => {
                setSeed(null)
                drawer.create()
              }}
            >
              New code
            </Button>
          ) : null
        }
      />
      <DataTable
        id="promos"
        label="Promo codes"
        searchPlaceholder="Search codes…"
        schema={promoListSchema}
        query={promoQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="-createdAt"
        rowId={(p) => p.id}
        rowLabel={(p) => p.code}
        rowActions={rowActions}
        bulkActions={[
          { id: 'enable', label: 'Switch on', permission: 'promos:write', done: (n) => `${n} switched on`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'enable' }) : { cancelled: true }) },
          { id: 'disable', label: 'Switch off', permission: 'promos:write', done: (n) => `${n} switched off`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'disable' }) : { cancelled: true }) },
        ]}
        selectAllMatching={false}
        empty={{ title: 'No promo codes yet', body: can('promos:write') ? 'Make the first one for a sale or a goodwill gesture.' : undefined }}
      />
      {drawer.editing ? <EditDrawer key={drawer.editing} id={drawer.editing} onClose={drawer.close} /> : null}
      {drawer.creating ? <PromoDrawer key={`new-${seed?.code ?? ''}`} promo={null} seed={seed ?? emptyForm()} onClose={() => (setSeed(null), drawer.close())} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.code ?? ''}?`}
        body="A code that no order has used can be deleted. One that has been used is switched off instead, so the orders keep their record."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.code} deleted`, tone: 'success' })
          } catch (e) {
            toast.push({ title: e instanceof ApiError && e.code === 'in_use' ? 'An order has used this code, so it cannot be deleted. Switch it off instead.' : messageFor(e), tone: 'danger' })
            throw e
          }
        }}
      />
    </>
  )
}
