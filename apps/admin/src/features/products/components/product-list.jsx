import { ApiError, enums } from '@noor/contract'
import { formatDate, formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { LinkButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Copy, Eye, Pencil, Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { categoriesQuery, categoryOptions } from '@/lib/catalog'
import { env } from '@/lib/env'
import { messageFor } from '@/lib/errors'
import { deleteAction } from '@/lib/bulk-delete'
import { useCan } from '@/lib/session'
import { useShortcut } from '@/lib/shortcuts'
import { productListSchema, productQueries, useProductMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminProductRow>} Row */

const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  {
    id: 'title',
    header: 'Product',
    sortable: true,
    cell: (p) => (
      <span className="inline-flex items-center gap-3">
        {p.image ? <img src={p.image.src} alt="" className="size-10 rounded-media object-cover" /> : <span aria-hidden className="size-10 rounded-media bg-surface-2" />}
        <span>
          {p.colorwayLabel ? `${p.title} (${p.colorwayLabel})` : p.title}
          <span className="block text-xs font-normal text-muted">{p.variantCount === 1 ? '1 variant' : `${p.variantCount} variants`}</span>
        </span>
      </span>
    ),
  },
  { id: 'status', header: 'Status', sortable: true, cell: (p) => <StatusBadge status={p.status} /> },
  { id: 'kind', header: 'Type', hideable: true, cell: (p) => humanise(p.kind) },
  { id: 'category', header: 'Category', hideable: true, cell: (p) => p.primaryCategory.name },
  { id: 'stock', header: 'Stock', cell: (p) => <StatusBadge status={p.stockStatus} /> },
    {
    id: 'price',
    header: 'Price',
    sortable: true,
    align: 'end',
    cell: (p) => (p.priceTo && p.priceTo.amount > p.priceFrom.amount ? `${formatMoney(p.priceFrom, 'en')} – ${formatMoney(p.priceTo, 'en')}` : formatMoney(p.priceFrom, 'en')),
  },
  { id: 'updatedAt', header: 'Updated', sortable: true, align: 'end', cell: (p) => <span className="whitespace-nowrap">{formatDate(p.updatedAt, 'en')}</span> },
]

/** @type {import('@/components/list-filters').FilterDef[]} */
const staticFilters = [
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

/** `/products` (plan/07-admin/03-products.md section 2). Status changes in bulk are built; export and import need endpoints that are not built yet. */
export function ProductList() {
  const can = useCan()
  const navigate = useNavigate()
  const toast = useToast()
  const { duplicate, remove, archive, previewLink, bulk } = useProductMutations()
  const categories = useQuery(categoriesQuery)
  const [deleting, setDeleting] = useState(/** @type {Row | null} */ (null))
  useShortcut('c', () => void navigate('/products/new'), { label: 'New product', when: can('products:write') })
  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [...(categories.data ? [/** @type {const} */ ({ key: 'category', label: 'Category', type: 'select', options: categoryOptions(/** @type {any} */ (categories.data.items)) })] : []), ...staticFilters]
  const fail = (/** @type {unknown} */ e) => toast.push({ title: messageFor(e), tone: 'danger' })
  /** @param {Row} p */
  const rowActions = (p) => [
    { label: 'Edit', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => void navigate(`/products/${p.id}`) },
    ...(can('products:write') ? [{ label: 'Duplicate', icon: <Copy aria-hidden className="size-4" />, onSelect: () => duplicate.mutate(p.id, { onSuccess: (copy) => void navigate(`/products/${copy.id}`), onError: fail }) }] : []),
    {
      label: 'View on storefront',
      icon: <Eye aria-hidden className="size-4" />,
      onSelect: () => (p.status === 'active' ? window.open(`${env.storefrontUrl}/p/${p.handle}`, '_blank', 'noopener') : previewLink.mutate(p.id, { onSuccess: (r) => window.open(r.url, '_blank', 'noopener'), onError: fail })),
    },
    ...(can('products:publish') && p.status !== 'archived' ? [{ label: 'Archive', icon: <Archive aria-hidden className="size-4" />, onSelect: () => archive.mutate(p.id, { onSuccess: () => toast.push({ title: `${p.title} archived`, tone: 'success' }), onError: fail }) }] : []),
    ...(can('products:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(p) }] : []),
  ]
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
        rowActions={rowActions}
        selectAllMatching={false}
        bulkActions={[
          { id: 'publish', label: 'Publish', permission: 'products:publish', done: (n) => `${n} published`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'publish' }) : { cancelled: true }) },
          { id: 'unpublish', label: 'Move to draft', permission: 'products:publish', done: (n) => `${n} moved to draft`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'unpublish' }) : { cancelled: true }) },
          { id: 'archive', label: 'Archive', permission: 'products:publish', done: (n) => `${n} archived`, run: async (t) => ('ids' in t ? bulk.mutateAsync({ ids: t.ids, action: 'archive' }) : { cancelled: true }) },
          deleteAction('admin.products.bulkDelete', 'products:delete'),
        ]}
        empty={{ title: 'No products yet', body: can('products:write') ? 'Create the first product to start selling.' : undefined }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title ?? ''}?`}
        body="It stays in the Trash for 30 days, so it can be put back. A product that has been ordered cannot be deleted: archive it instead."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.title} deleted`, tone: 'success' })
          } catch (error) {
            toast.push({ title: error instanceof ApiError && error.code === 'in_use' ? 'This product has orders, so it cannot be deleted. Archive it instead.' : messageFor(error), tone: 'danger' })
            throw error
          }
        }}
      />
    </>
  )
}
