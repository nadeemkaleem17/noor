import { ApiError, SizeChartInput } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { Field, RHFField } from '@noor/ui/field'
import { ImageUpload } from '@noor/ui/image-upload'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { NativeSelect } from '@noor/ui/native-select'
import { Table, Td, Th } from '@noor/ui/table'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { AppLink } from '@/components/app-link'
import { FormDrawer } from '@/components/form-drawer'
import { api } from '@/lib/api'
import { sizeChartsQuery, sizeSystemsQuery } from '@/lib/catalog'
import { inUseText, messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { uploadErrorText, uploadImage } from '@/lib/upload'
import { useDrawer } from '@/lib/use-drawer'
import { useSizeChartMutations } from '../api'
import { ChartGrid } from './chart-grid'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminSizeChart>} SizeChart */

const emptyTable = () => ({ id: `t${Math.random().toString(36).slice(2, 8)}`, title: '', columns: [''], rows: [{ label: '', values: /** @type {(number | undefined)[]} */ ([]) }] })

/**
 * @param {{ chart: SizeChart | null; onClose: () => void; }} props
 */
function SizeChartDrawer({ chart, onClose }) {
  const { create, update } = useSizeChartMutations()
  const { data: systems } = useSuspenseQuery(sizeSystemsQuery)
  const toast = useToast()
  const [image, setImage] = useState(/** @type {{ id: string; src: string; alt: string; } | null} */ (chart?.guideImage && chart.guideMediaId ? { id: chart.guideMediaId, src: chart.guideImage.src, alt: chart.guideImage.alt } : null))
  const [altBefore] = useState(image?.alt ?? '')
  const form = useForm({
    defaultValues: { title: chart?.title ?? '', sizeSystemId: chart?.sizeSystemId ?? '', unit: chart?.unit ?? 'in', notes: chart?.notes ?? '', tables: chart?.tables ?? [emptyTable()] },
    resolver: contractResolver(SizeChartInput, (/** @type {any} */ v) => body(v)),
  })
  const systemId = useWatch({ control: form.control, name: 'sizeSystemId' })
  const system = systems.items.find((s) => s.id === systemId)

  /** @param {any} v */
  const body = (v) => ({ ...prune({ ...v, sizeSystemId: undefined, tables: undefined }), sizeSystemId: v.sizeSystemId || null, guideMediaId: image?.id ?? null, tables: v.tables })

  async function save() {
    try {
      const doc = body(form.getValues())
      if (image && image.alt !== altBefore) await api('admin.media.update', { params: { id: image.id }, body: { alt: image.alt } })
      if (chart) await update.mutateAsync({ id: chart.id, body: { ...doc, version: chart.version } })
      else await create.mutateAsync(doc)
      toast.push({ title: 'Size chart saved', tone: 'success' })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  const tableErrors = form.formState.errors.tables
  return (
    <FormDrawer open title={chart ? `Edit ${chart.title}` : 'New size chart'} onClose={onClose} formId="size-chart-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="title" label="Title" required>
        {(field) => <Input {...field} maxLength={100} required />}
      </RHFField>
      <div className="grid gap-3 sm:grid-cols-2">
        <RHFField control={form.control} name="sizeSystemId" label="Size system" hint="Optional. New tables start with its sizes as rows.">
          {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="None" options={systems.items.map((s) => ({ value: s.id, label: s.name }))} />}
        </RHFField>
        <RHFField control={form.control} name="unit" label="Unit" hint="Measurements are entered in this unit; the shop converts for display.">
          {(field) => (
            <NativeSelect
              {...field}
              options={[
                { value: 'in', label: 'Inches' },
                { value: 'cm', label: 'Centimetres' },
              ]}
            />
          )}
        </RHFField>
      </div>
      {tableErrors ? <p role="alert" className="text-sm text-danger">Some cells are empty or the tables are incomplete. Every row needs a size and a number in every column.</p> : null}
      <Controller control={form.control} name="tables" render={({ field }) => <ChartGrid tables={field.value} onChange={field.onChange} rowLabels={system?.values.map((/** @type {{ label: string; }} */ v) => v.label)} />} />
      <Field label="How to measure picture" hint="Optional.">
        <div className="space-y-2">
          <ImageUpload
            value={image ? [{ id: image.id, src: image.src, alt: image.alt }] : []}
            maxFiles={1}
            onChange={(list) => {
              const last = list.at(-1)
              setImage(last ? { id: last.id, src: last.src, alt: last.alt ?? '' } : null)
            }}
            upload={(file) => uploadImage(file)}
            describeError={uploadErrorText}
          />
          {image ? <Input aria-label="Picture alt text" placeholder="Alt text: describe the picture" value={image.alt} maxLength={300} onChange={(e) => setImage({ ...image, alt: e.target.value })} /> : null}
        </div>
      </Field>
      <RHFField control={form.control} name="notes" label="Notes">
        {(field) => <Textarea {...field} value={field.value ?? ''} rows={2} maxLength={400} />}
      </RHFField>
      {chart ? (
        <p className="text-sm text-muted">
          Used by <AppLink to="/products">{chart.usedBy === 1 ? '1 product' : `${chart.usedBy} products`}</AppLink>.
        </p>
      ) : null}
    </FormDrawer>
  )
}

/** The "Size charts" tab. */
export function SizeChartsTab() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useSizeChartMutations()
  const { data } = useSuspenseQuery(sizeChartsQuery)
  const items = /** @type {SizeChart[]} */ (/** @type {unknown} */ (data.items))
  const [deleting, setDeleting] = useState(/** @type {SizeChart | null} */ (null))
  const editing = drawer.editing ? (items.find((c) => c.id === drawer.editing) ?? null) : null

  return (
    <div className="space-y-4 pt-4">
      {can('catalog:write') ? (
        <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>
          New size chart
        </Button>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No size charts yet" body="Charts are the measurement tables of the shop's size guide." />
      ) : (
        <Table label="Size charts">
          <caption className="sr-only">Size charts</caption>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Unit</Th>
              <Th numeric>Tables</Th>
              <Th numeric>Used by</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <button type="button" className="font-medium hover:underline" onClick={() => drawer.edit(c.id)}>
                    {c.title}
                  </button>
                </Td>
                <Td>{c.unit === 'in' ? 'Inches' : 'Centimetres'}</Td>
                <Td numeric>{c.tables.length}</Td>
                <Td numeric>{c.usedBy === 1 ? '1 product' : `${c.usedBy} products`}</Td>
                <Td>
                  <Menu
                    align="end"
                    trigger={<IconButton label={`Actions for ${c.title}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                    items={[
                      { label: can('catalog:write') ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(c.id) },
                      ...(can('catalog:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(c) }] : []),
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {drawer.isOpen && (drawer.creating !== null || editing) ? <SizeChartDrawer key={drawer.editing ?? 'new'} chart={editing} onClose={drawer.close} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title ?? ''}?`}
        body={deleting ? `${deleting.usedBy} products use it. A chart that products use cannot be deleted. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.title} deleted`, tone: 'success' })
          } catch (error) {
            toast.push({ title: inUseText(error), tone: 'danger' })
            throw error
          }
        }}
      />
    </div>
  )
}
