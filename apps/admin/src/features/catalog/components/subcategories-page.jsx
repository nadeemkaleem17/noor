import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { VisuallyHidden } from '@noor/ui/visually-hidden'
import { useQuery } from '@tanstack/react-query'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { useBulkDelete } from '@/components/bulk-delete'
import { PageHeader } from '@/components/page-header'
import { categoriesQuery } from '@/lib/catalog'
import { inUseText } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { useCategoryMutations } from '../api'
import { CategoryDrawer } from './category-drawer'

/** @typedef {import('./category-drawer').Category} Category */

const whyNot = /** @type {Record<'hidden' | 'parent_hidden' | 'no_live_products', string>} */ ({
  hidden: 'Hidden',
  parent_hidden: 'A category above it is hidden',
  no_live_products: 'No product for sale yet',
})

/**
 * `/subcategories` (plan/17-owner-requests-2026-10.md item 7): every category that has a parent, as one table with its parent beside it. It reads the same list as the tree on
 * `/categories`, so the two never disagree; add, edit and delete are the same drawer and the same rules.
 */
export function SubcategoriesPage() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useCategoryMutations()
  const categories = useQuery(categoriesQuery)
  const all = /** @type {Category[]} */ (/** @type {unknown} */ (categories.data?.items ?? []))
  const byId = new Map(all.map((c) => [c.id, c]))
  const [text, setText] = useState('')
  const [parent, setParent] = useState('')
  const [shown, setShown] = useState('')
  const [deleting, setDeleting] = useState(/** @type {Category | null} */ (null))
  const bulk = useBulkDelete({ route: 'admin.categories.bulkDelete', noun: ['subcategory', 'subcategories'], nameOf: (id) => byId.get(id)?.name ?? id, refresh: [categoriesQuery.queryKey] })

  /** The names from the top down: "Women › Unstitched". @param {Category} c */
  const trail = (c) => {
    const names = []
    for (let p = c.parentId ? byId.get(c.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) names.unshift(p.name)
    return names
  }
  const level = (/** @type {Category} */ c) => trail(c).length + 1
  /** Is `id` above `c`, at any depth? @param {Category} c @param {string} id */
  const under = (c, id) => {
    for (let p = c.parentId ? byId.get(c.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) if (p.id === id) return true
    return false
  }

  const q = text.trim().toLowerCase()
  const rows = all
    .filter((c) => c.parentId)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q))
    .filter((c) => !parent || c.parentId === parent || under(c, parent))
    .filter((c) => (shown === 'shown' ? c.shop.shown : shown === 'not' ? !c.shop.shown : true))
    .toSorted((a, b) => trail(a).join('›').localeCompare(trail(b).join('›')) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const parentChoices = all.filter((c) => level(c) < 3).toSorted((a, b) => [...trail(a), a.name].join('›').localeCompare([...trail(b), b.name].join('›')))
  const editing = drawer.editing ? (all.find((c) => c.id === drawer.editing) ?? null) : null
  const canDelete = can('catalog:delete')
  const allChosen = rows.length > 0 && rows.every((c) => bulk.isSelected(c.id))

  return (
    <>
      <PageHeader
        title="Subcategories"
        description="Every category that sits under another one, with its parent. The same categories as the tree on Categories."
        actions={
          can('catalog:write') ? (
            <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create(parent || parentChoices[0]?.id || '1')} disabled={parentChoices.length === 0}>
              New subcategory
            </Button>
          ) : null
        }
      />
      {categories.isPending ? <Spinner label="Loading subcategories" /> : null}
      {categories.isError ? <ErrorState title="Subcategories could not be loaded" retryLabel="Try again" onRetry={() => void categories.refetch()} /> : null}
      {categories.isSuccess ? (
        <>
          <div role="search" className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
              Search
              <Input type="search" value={text} placeholder="Name or handle…" onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Parent
              <NativeSelect value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Any parent" options={parentChoices.map((c) => ({ value: c.id, label: [...trail(c), c.name].join(' › ') }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              On the website
              <NativeSelect
                value={shown}
                onChange={(e) => setShown(e.target.value)}
                placeholder="All"
                options={[
                  { value: 'shown', label: 'Shown' },
                  { value: 'not', label: 'Not shown' },
                ]}
              />
            </label>
          </div>
          {bulk.bar}
          {all.every((c) => !c.parentId) ? (
            <EmptyState title="No subcategories yet" body="Add one with “New subcategory”, or from a category's menu on the Categories screen." />
          ) : rows.length === 0 ? (
            <EmptyState title="No subcategory matches" body="Change the search or the filters." />
          ) : (
            <Table label="Subcategories">
              <caption className="sr-only">Subcategories</caption>
              <thead>
                <tr>
                  {canDelete ? (
                    <Th>
                      <Checkbox label={<VisuallyHidden>Select all shown subcategories</VisuallyHidden>} checked={allChosen} onCheckedChange={(on) => bulk.setAll(on ? rows.map((c) => c.id) : [])} />
                    </Th>
                  ) : null}
                  <Th>Name</Th>
                  <Th>Parent</Th>
                  <Th numeric>Products</Th>
                  <Th>On the website</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    {canDelete ? (
                      <Td>
                        <Checkbox label={<VisuallyHidden>{`Select ${c.name}`}</VisuallyHidden>} checked={bulk.isSelected(c.id)} onCheckedChange={() => bulk.toggle(c.id)} />
                      </Td>
                    ) : null}
                    <Td>
                      <button type="button" className="font-medium hover:underline" onClick={() => drawer.edit(c.id)}>
                        {c.name}
                      </button>
                      <span className="block text-xs text-muted">/c/{c.handle}</span>
                    </Td>
                    <Td>{trail(c).join(' › ')}</Td>
                    <Td numeric>
                      <AppLink to={`/products?category=${c.id}`} className="text-accent-text underline underline-offset-2">
                        {c.productCount}
                      </AppLink>
                    </Td>
                    <Td>{c.shop.shown ? 'Shown' : <span className="text-warning">{whyNot[c.shop.reason ?? 'hidden']}</span>}</Td>
                    <Td>
                      <Menu
                        align="end"
                        trigger={<IconButton label={`Actions for ${c.name}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                        items={[
                          { label: can('catalog:write') ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(c.id) },
                          ...(can('catalog:write') && level(c) < 3 ? [{ label: 'Add a subcategory', icon: <Plus aria-hidden className="size-4" />, onSelect: () => drawer.create(c.id) }] : []),
                          ...(canDelete ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(c) }] : []),
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      ) : null}
      {drawer.isOpen && categories.isSuccess && (drawer.creating !== null || editing) ? (
        <CategoryDrawer key={drawer.editing ?? `new-${drawer.creating}`} open category={editing} parentId={drawer.creating && drawer.creating !== '1' ? drawer.creating : ''} onClose={drawer.close} />
      ) : null}
      {bulk.dialogs}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="Products that are only tagged with it lose the tag. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.name} deleted`, tone: 'success' })
          } catch (error) {
            toast.push({ title: inUseText(error), tone: 'danger' })
            throw error
          }
        }}
      />
    </>
  )
}
