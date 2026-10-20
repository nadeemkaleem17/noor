import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { deliveryPeopleQuery } from '@/lib/delivery'
import { runListSchema, deliveryQueries } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').RunRow>} Row */

export const runTone = /** @type {Record<string, 'neutral' | 'accent' | 'success'>} */ ({ open: 'neutral', out: 'accent', closed: 'success' })
export const runStatusText = /** @type {Record<string, string>} */ ({ open: 'Open', out: 'Out with the rider', closed: 'Closed' })
const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  { id: 'number', header: 'Run', cell: (r) => <span className="font-medium">{r.number}</span> },
  { id: 'runDate', header: 'Date', cell: (r) => r.runDate },
  { id: 'personName', header: 'Delivery person', cell: (r) => r.personName },
  { id: 'status', header: 'Status', cell: (r) => <Badge tone={runTone[r.status] ?? 'neutral'}>{runStatusText[r.status]}</Badge> },
  { id: 'orders', header: 'Orders', align: 'end', cell: (r) => r.orders },
  { id: 'cashDue', header: 'Cash to collect', align: 'end', cell: (r) => rupees(r.cashDue) },
  { id: 'collected', header: 'Collected', align: 'end', cell: (r) => rupees(r.collected) },
]

/** `/delivery/runs` (plan/18-delivery-assignment-ledger-receipts.md section 5): the sheets given to riders. A run is made from the Orders list: choose orders, Assign to a person. */
export function RunsPage() {
  const people = useQuery(deliveryPeopleQuery)
  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'out', label: 'Out with the rider' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    ...(people.data ? [/** @type {const} */ ({ key: 'personId', label: 'Person', type: 'select', options: people.data.items.map((p) => ({ value: p.id, label: p.name })) })] : []),
  ]
  return (
    <>
      <PageHeader title="Delivery runs" description="Orders given to a rider for a day. Make one from the Orders list: choose confirmed orders, then Assign to a rider." />
      <DataTable
        id="delivery-runs"
        label="Delivery runs"
        schema={runListSchema}
        query={deliveryQueries.runs}
        columns={columns}
        filters={filters}
        defaultSort="-runDate"
        rowId={(r) => r.id}
        rowLabel={(r) => r.number}
        rowHref={(r) => `/delivery/runs/${r.id}`}
        empty={{ title: 'No runs yet', body: 'Choose confirmed orders on the Orders list and use Assign to a rider.' }}
      />
    </>
  )
}
