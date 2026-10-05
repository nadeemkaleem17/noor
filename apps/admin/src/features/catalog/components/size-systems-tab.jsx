import { ApiError, SizeSystemInput } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { FormDrawer } from '@/components/form-drawer'
import { sizeSystemsQuery } from '@/lib/catalog'
import { inUseText, messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { useSizeSystemMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminSizeSystem>} SizeSystem */

/**
 * An ordered list of size labels (plan/07-admin/04-catalog.md section 5.1). A size a variant uses cannot be removed.
 * @param {{ system: SizeSystem | null; onClose: () => void; }} props
 */
function SizeSystemDrawer({ system, onClose }) {
  const { create, update } = useSizeSystemMutations()
  const toast = useToast()
  const form = useForm({
    defaultValues: { name: system?.name ?? '', values: system ? system.values.map((v) => ({ id: v.id, label: v.label, used: v.usedByVariants })) : [{ label: '' }] },
    resolver: contractResolver(SizeSystemInput, (/** @type {any} */ v) => body(v)),
  })
  const values = useFieldArray({ control: form.control, name: 'values', keyName: 'rid' })

  /** @param {any} v */
  const body = (v) => prune({ name: v.name, values: (v.values ?? []).map((/** @type {any} */ x) => ({ id: x.id, label: x.label })) })

  async function save() {
    try {
      const doc = body(form.getValues())
      if (system) await update.mutateAsync({ id: system.id, body: doc })
      else await create.mutateAsync(doc)
      toast.push({ title: 'Size system saved', tone: 'success' })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: error instanceof ApiError && error.code === 'in_use' ? 'A size that variants use cannot be removed.' : messageFor(error), tone: 'danger' })
    }
  }

  return (
    <FormDrawer open title={system ? `Edit ${system.name}` : 'New size system'} onClose={onClose} formId="size-system-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="name" label="Name" required>
        {(field) => <Input {...field} maxLength={60} required />}
      </RHFField>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Sizes, in order</legend>
        {values.fields.map((f, i) => {
          const used = /** @type {number} */ (/** @type {any} */ (f).used ?? 0)
          return (
            <div key={f.rid} className="flex items-end gap-2">
              <RHFField control={form.control} name={`values.${i}.label`} label={`Size ${i + 1}`} className="flex-1">
                {(field) => <Input {...field} maxLength={10} />}
              </RHFField>
              <IconButton label={`Move size ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => values.move(i, i - 1)} />
              <IconButton label={`Move size ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === values.fields.length - 1} onClick={() => values.move(i, i + 1)} />
              <IconButton
                label={`Remove size ${i + 1}`}
                icon={<Trash2 aria-hidden className="size-4" />}
                disabled={used > 0}
                title={used > 0 ? `${used} variants use this size` : undefined}
                onClick={() => values.remove(i)}
              />
            </div>
          )
        })}
        {values.fields.length < 40 ? (
          <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => values.append({ label: '' })}>
            Add a size
          </Button>
        ) : null}
      </fieldset>
    </FormDrawer>
  )
}

/** The "Size systems" tab. */
export function SizeSystemsTab() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useSizeSystemMutations()
  const { data } = useSuspenseQuery(sizeSystemsQuery)
  const items = /** @type {SizeSystem[]} */ (/** @type {unknown} */ (data.items))
  const [deleting, setDeleting] = useState(/** @type {SizeSystem | null} */ (null))
  const editing = drawer.editing ? (items.find((s) => s.id === drawer.editing) ?? null) : null

  return (
    <div className="space-y-4 pt-4">
      {can('catalog:write') ? (
        <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>
          New size system
        </Button>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No size systems yet" body="A size system is the list of sizes a product's size option picks from." />
      ) : (
        <Table label="Size systems">
          <caption className="sr-only">Size systems</caption>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Sizes</Th>
              <Th numeric>Used by</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <Td>
                  <button type="button" className="font-medium hover:underline" onClick={() => drawer.edit(s.id)}>
                    {s.name}
                  </button>
                </Td>
                <Td>{s.values.map((v) => v.label).join(', ')}</Td>
                <Td numeric>{s.values.reduce((n, v) => n + v.usedByVariants, 0)} variants</Td>
                <Td>
                  <Menu
                    align="end"
                    trigger={<IconButton label={`Actions for ${s.name}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                    items={[
                      { label: can('catalog:write') ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(s.id) },
                      ...(can('catalog:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(s) }] : []),
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {drawer.isOpen && (drawer.creating !== null || editing) ? <SizeSystemDrawer key={drawer.editing ?? 'new'} system={editing} onClose={drawer.close} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="This cannot be undone. A size system that a product option uses cannot be deleted."
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
    </div>
  )
}
