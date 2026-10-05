import { enums } from '@noor/contract'
import { formatDate, formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { LinkButton } from '@noor/ui/button'
import { Link as RouterLink } from 'react-router'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { useCan } from '@/lib/session'
import { productListSchema, productQueries } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminProductRow>} Row */

const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  { id: 'title', header: 'Product', sortable: true, cell: (p) => (p.colorwayLabel ? `${p.title} (${p.colorwayLabel})` : p.title) },
  { id: 'status', header: 'Status', sortable: true, cell: (p) => <StatusBadge status={p.status} /> },
  { id: 'kind', header: 'Type', hideable: true, cell: (p) => humanise(p.kind) },
  { id: 'category', header: 'Category', hideable: true, cell: (p) => p.primaryCategory.name },
  { id: 'stock', header: 'Stock', cell: (p) => <StatusBadge status={p.stockStatus} /> },
  { id: 'variants', header: 'Variants', align: 'end', hideable: true, defaultHidden: true, cell: (p) => p.variantCount },
  {
    id: 'price',
    header: 'Price',
    sortable: true,
    align: 'end',
    cell: (p) => (p.priceTo && p.priceTo.amount > p.priceFrom.amount ? `${formatMoney(p.priceFrom, 'en')} – ${formatMoney(p.priceTo, 'en')}` : formatMoney(p.priceFrom, 'en')),
  },
  { id: 'updatedAt', header: 'Updated', sortable: true, align: 'end', cell: (p) => formatDate(p.updatedAt, 'en') },
]

/** @type {import('@/components/list-filters').FilterDef[]} */
const filters = [
  { key: 'status', label: 'Status', type: 'select', options: enums.productStatus.map((v) => ({ value: v, label: humanise(v) })) },
  { key: 'kind', label: 'Type', type: 'select', options: enums.productKind.map((v) => ({ value: v, label: humanise(v) })) },
  {
    key: 'stock',
    label: 'Stock',
    type: 'select',
    options: [
      { value: 'in', label: 'In stock' },
      { value: 'low', label: 'Low stock' },
      { value: 'sold_out', label: 'Sold out' },
      { value: 'mto', label: 'Made to order' },
    ],
  },
]

/** `/products` (plan/07-admin/03-products.md): the list; the editor and bulk actions arrive with M3-03. */
export function ProductList() {
  const can = useCan()
  return (
    <>
      <PageHeader
        title="Products"
        actions={can('products:write') ? <LinkButton href="/products/new" render={<RouterLink to="/products/new" />}>New product</LinkButton> : null}
      />
      <DataTable
        id="products"
        label="Products"
        searchPlaceholder="Search title, SKU or handle…"
        schema={productListSchema}
        query={productQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="-updatedAt"
        rowId={(p) => p.id}
        rowLabel={(p) => p.title}
        rowHref={(p) => `/products/${p.id}`}
        empty={{ title: 'No products yet', body: can('products:write') ? 'Create the first product to start selling.' : undefined }}
      />
    </>
  )
}
