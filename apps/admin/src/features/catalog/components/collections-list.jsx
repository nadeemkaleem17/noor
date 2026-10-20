import { StatusBadge } from '@noor/ui/badge'
import { LinkButton } from '@noor/ui/button'
import { formatDate } from '@noor/i18n/format'
import { Link as RouterLink } from 'react-router'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { deleteAction } from '@/lib/bulk-delete'
import { useCan } from '@/lib/session'
import { collectionListSchema, collectionQueries } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCollectionRow>} Row */

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  { id: 'title', header: 'Title', cell: (c) => c.title },
  { id: 'handle', header: 'Handle', cell: (c) => <span className="font-mono text-sm">{c.handle}</span> },
  { id: 'products', header: 'Products', align: 'end', cell: (c) => c.productCount },
  { id: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
  { id: 'featured', header: 'Featured', hideable: true, cell: (c) => (c.featured ? 'Yes' : 'No') },
  { id: 'updatedAt', header: 'Updated', align: 'end', cell: (c) => <span className="whitespace-nowrap">{formatDate(c.updatedAt, 'en')}</span> },
]

/** @type {import('@/components/list-filters').FilterDef[]} */
const filters = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
    ],
  },
]

/** `/collections` (plan/07-admin/04-catalog.md section 3). */
export function CollectionsList() {
  const can = useCan()
  return (
    <>
      <PageHeader title="Collections" description="Hand-picked, ordered sets of products with their own page." actions={can('catalog:write') ? <LinkButton href="/collections/new" render={<RouterLink to="/collections/new" />}>New collection</LinkButton> : null} />
      <DataTable
        id="collections"
        label="Collections"
        searchPlaceholder="Search title or handle…"
        schema={collectionListSchema}
        query={collectionQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="-updatedAt"
        rowId={(c) => c.id}
        rowLabel={(c) => c.title}
        rowHref={(c) => `/collections/${c.id}`}
        bulkActions={[deleteAction('admin.collections.bulkDelete', 'catalog:delete')]}
        selectAllMatching={false}
        empty={{ title: 'No collections yet', body: can('catalog:write') ? 'Create one to group products for a drop or a season.' : undefined }}
      />
    </>
  )
}
