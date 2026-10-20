import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Menu } from '@noor/ui/menu'
import { Spinner } from '@noor/ui/spinner'
import { Checkbox } from '@noor/ui/checkbox'
import { Table, Td, Th } from '@noor/ui/table'
import { VisuallyHidden } from '@noor/ui/visually-hidden'
import { useBulkDelete } from '@/components/bulk-delete'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { attributesQuery } from '@/lib/catalog'
import { inUseText } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { useAttributeMutations } from '../api'
import { AttributeDrawer } from './attribute-drawer'

/** @typedef {import('./attribute-drawer').Attribute} Attribute */

const humanise = (/** @type {string} */ v) => v.replace(/^./, (c) => c.toUpperCase())

/** `/attributes` (plan/07-admin/04-catalog.md section 4). The list is short and not paged, so it is a plain table, not a `DataTable`. */
export function AttributesPage() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useAttributeMutations()
  const attributes = useQuery(attributesQuery)
  const [deleting, setDeleting] = useState(/** @type {Attribute | null} */ (null))
  const items = /** @type {Attribute[]} */ (/** @type {unknown} */ (attributes.data?.items ?? []))
  const editing = drawer.editing ? (items.find((a) => a.id === drawer.editing) ?? null) : null
  const bulk = useBulkDelete({ route: 'admin.attributes.bulkDelete', noun: ['attribute', 'attributes'], nameOf: (id) => items.find((a) => a.id === id)?.label ?? id, refresh: [attributesQuery.queryKey] })
  const canDelete = can('catalog:delete')
  const groups = [...new Set(items.flatMap((a) => (a.group ? [a.group] : [])))]

  return (
    <>
      <PageHeader
        title="Attributes"
        description="What describes a product: fabric, technique, occasion. They drive the shop's filters."
        actions={can('catalog:write') ? <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>New attribute</Button> : null}
      />
      {attributes.isPending ? <Spinner label="Loading attributes" /> : null}
      {attributes.isError ? <ErrorState title="Attributes could not be loaded" retryLabel="Try again" onRetry={() => void attributes.refetch()} /> : null}
      {attributes.isSuccess && items.length === 0 ? <EmptyState title="No attributes yet" body="Create the first one to describe your products." /> : null}
      {bulk.bar}
      {items.length > 0 ? (
        <Table label="Attributes">
          <caption className="sr-only">Attributes</caption>
          <thead>
            <tr>
              {canDelete ? (
                <Th>
                  <Checkbox label={<VisuallyHidden>Select all attributes</VisuallyHidden>} checked={items.every((a) => bulk.isSelected(a.id))} onCheckedChange={(on) => bulk.setAll(on ? items.map((a) => a.id) : [])} />
                </Th>
              ) : null}
              <Th>Label</Th>
              <Th>Key</Th>
              <Th>Type</Th>
              <Th>Display</Th>
              <Th numeric>Values</Th>
              <Th>Filter</Th>
              <Th numeric>Used by</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                {canDelete ? (
                  <Td>
                    <Checkbox label={<VisuallyHidden>{`Select ${a.label}`}</VisuallyHidden>} checked={bulk.isSelected(a.id)} onCheckedChange={() => bulk.toggle(a.id)} />
                  </Td>
                ) : null}
                <Td>
                  <button type="button" className="font-medium hover:underline" onClick={() => drawer.edit(a.id)}>
                    {a.label}
                  </button>
                  {a.group ? <span className="block text-xs text-muted">{a.group}</span> : null}
                </Td>
                <Td className="font-mono text-sm">{a.code}</Td>
                <Td>{humanise(a.type)}</Td>
                <Td>{humanise(a.display)}</Td>
                <Td numeric>{a.values.length}</Td>
                <Td>{a.filterable ? 'Yes' : 'No'}</Td>
                <Td numeric>{a.usedByProducts === 1 ? '1 product' : `${a.usedByProducts} products`}</Td>
                <Td>
                  <Menu
                    align="end"
                    trigger={<IconButton label={`Actions for ${a.label}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                    items={[
                      { label: can('catalog:write') ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(a.id) },
                      ...(can('catalog:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(a) }] : []),
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {drawer.isOpen && attributes.isSuccess && (drawer.creating !== null || editing) ? <AttributeDrawer key={drawer.editing ?? 'new'} open attribute={editing} groups={groups} onClose={drawer.close} /> : null}
      {bulk.dialogs}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.label ?? ''}?`}
        body={deleting ? `${deleting.usedByProducts} products and ${deleting.usedByCategories} categories use it. It can only be deleted when nothing does.` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.label} deleted`, tone: 'success' })
          } catch (error) {
            toast.push({ title: inUseText(error), tone: 'danger' })
            throw error
          }
        }}
      />
    </>
  )
}
