import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Menu } from '@noor/ui/menu'
import { Spinner } from '@noor/ui/spinner'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { categoriesQuery } from '@/lib/catalog'
import { inUseText } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { useCategoryMutations } from '../api'
import { CategoryDrawer } from './category-drawer'

/** @typedef {import('./category-drawer').Category} Category */

/**
 * The category tree (plan/07-admin/04-catalog.md section 2): expand and collapse, reorder within siblings, edit in a drawer.
 * @param {{ all: Category[]; parentId: string | null; level: number; collapsed: Set<string>; onToggle: (id: string) => void; canWrite: boolean; canDelete: boolean; onEdit: (id: string) => void; onAdd: (parentId: string) => void; onDelete: (c: Category) => void; onMove: (parentId: string | null, orderedIds: string[]) => void; }} props
 */
function Branch({ all, parentId, level, collapsed, onToggle, canWrite, canDelete, onEdit, onAdd, onDelete, onMove }) {
  const siblings = all.filter((c) => (c.parentId ?? null) === parentId).toSorted((a, b) => a.sortOrder - b.sortOrder)
  const ids = siblings.map((c) => c.id)
  return (
    <ul role={parentId === null ? 'tree' : 'group'} aria-label={parentId === null ? 'Categories' : undefined} className="space-y-1">
      {siblings.map((c, i) => {
        const children = all.filter((x) => x.parentId === c.id)
        const open = children.length > 0 && !collapsed.has(c.id)
        const swap = (/** @type {number} */ to) => {
          const next = [...ids]
          const [moved] = next.splice(i, 1)
          if (moved) next.splice(to, 0, moved)
          onMove(parentId, next)
        }
        return (
          <li key={c.id} role="treeitem" aria-level={level} aria-expanded={children.length ? open : undefined}>
            <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-2 py-1" style={{ marginInlineStart: `${(level - 1) * 1.5}rem` }}>
              {children.length ? (
                <IconButton label={`${open ? 'Collapse' : 'Expand'} ${c.name}`} icon={open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />} onClick={() => onToggle(c.id)} />
              ) : (
                <span className="size-11" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <button type="button" className="font-medium hover:underline" onClick={() => onEdit(c.id)}>
                  {c.name}
                </button>
                {c.visible ? null : <span className="ms-2 text-xs text-muted">Hidden</span>}
                <span className="block text-xs text-muted">/c/{c.handle}</span>
              </span>
              <AppLink to={`/products?category=${c.id}`} className="whitespace-nowrap text-sm text-accent-text underline underline-offset-2">
                {c.productCount === 1 ? '1 product' : `${c.productCount} products`}
              </AppLink>
              {canWrite ? (
                <>
                  <IconButton label={`Move ${c.name} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => swap(i - 1)} />
                  <IconButton label={`Move ${c.name} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === siblings.length - 1} onClick={() => swap(i + 1)} />
                </>
              ) : null}
              <Menu
                align="end"
                trigger={<IconButton label={`Actions for ${c.name}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                items={[
                  { label: canWrite ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => onEdit(c.id) },
                  ...(canWrite && level < 3 ? [{ label: 'Add a subcategory', icon: <Plus aria-hidden className="size-4" />, onSelect: () => onAdd(c.id) }] : []),
                  ...(canDelete ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => onDelete(c) }] : []),
                ]}
              />
            </div>
            {open ? <Branch all={all} parentId={c.id} level={level + 1} collapsed={collapsed} onToggle={onToggle} canWrite={canWrite} canDelete={canDelete} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} onMove={onMove} /> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** `/categories`. */
export function CategoriesPage() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove, reorder } = useCategoryMutations()
  const categories = useQuery(categoriesQuery)
  const [collapsed, setCollapsed] = useState(/** @type {Set<string>} */ (new Set()))
  const [deleting, setDeleting] = useState(/** @type {Category | null} */ (null))
  const all = /** @type {Category[]} */ (/** @type {unknown} */ (categories.data?.items ?? []))
  const editing = drawer.editing ? (all.find((c) => c.id === drawer.editing) ?? null) : null

  return (
    <>
      <PageHeader
        title="Categories"
        description="The shop's navigation tree, up to three levels."
        actions={can('catalog:write') ? <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>New category</Button> : null}
      />
      {categories.isPending ? <Spinner label="Loading categories" /> : null}
      {categories.isError ? <ErrorState title="Categories could not be loaded" retryLabel="Try again" onRetry={() => void categories.refetch()} /> : null}
      {categories.isSuccess && all.length === 0 ? <EmptyState title="No categories yet" body="Categories group products in the shop's menus and filters." /> : null}
      {all.length > 0 ? (
        <Branch
          all={all}
          parentId={null}
          level={1}
          collapsed={collapsed}
          onToggle={(id) => setCollapsed((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))}
          canWrite={can('catalog:write')}
          canDelete={can('catalog:delete')}
          onEdit={drawer.edit}
          onAdd={(parent) => drawer.create(parent)}
          onDelete={setDeleting}
          onMove={(parentId, orderedIds) => reorder.mutate({ parentId, orderedIds }, { onError: () => toast.push({ title: 'The order could not be saved, so it was put back.', tone: 'danger' }) })}
        />
      ) : null}

      {drawer.isOpen && categories.isSuccess && (drawer.creating !== null || editing) ? (
        <CategoryDrawer key={drawer.editing ?? `new-${drawer.creating}`} open category={editing} parentId={drawer.creating && drawer.creating !== '1' ? drawer.creating : ''} onClose={drawer.close} />
      ) : null}
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
