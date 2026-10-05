import { ApiError, FormSchemaInput } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { Field, RHFField } from '@noor/ui/field'
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
import { FormDrawer } from '@/components/form-drawer'
import { FormFieldsEditor, fieldsFromApi, fieldsToApi, newField } from '@/components/form-fields-editor'
import { formSchemasQuery } from '@/lib/catalog'
import { inUseText, messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { useFormSchemaMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminFormSchema>} FormSchemaRow */

/**
 * What the customer will see (plan/07-admin/04-catalog.md section 5.3), drawn from the fields being edited.
 * @param {{ fields: any[]; allowNotes: boolean; }} props
 */
function Preview({ fields, allowNotes }) {
  return (
    <div role="group" aria-label="Preview of the form" className="space-y-3 rounded-card border border-line bg-surface-2 p-3">
      <p className="text-sm font-medium">Preview</p>
      {fields.filter((f) => f.label).map((f, i) => (
        <Field key={i} label={f.label} required={f.required} hint={f.helpText || undefined}>
          {f.type === 'select' ? (
            <NativeSelect disabled placeholder="Choose" options={(f.options ?? []).map((/** @type {{ value: string; label: string; }} */ o) => ({ value: o.value, label: o.label }))} />
          ) : f.type === 'textarea' ? (
            <Textarea disabled rows={2} />
          ) : f.type === 'checkbox' ? (
            <Checkbox disabled label={f.label} />
          ) : (
            <Input disabled type={f.type === 'number' ? 'text' : f.type} suffix={f.unit} placeholder={f.type === 'number' ? '0' : undefined} />
          )}
        </Field>
      ))}
      {allowNotes ? (
        <Field label="Anything else?">
          <Textarea disabled rows={2} />
        </Field>
      ) : null}
    </div>
  )
}

/** @param {{ schema: FormSchemaRow | null; onClose: () => void; }} props */
function FormSchemaDrawer({ schema, onClose }) {
  const { create, update } = useFormSchemaMutations()
  const toast = useToast()
  const form = useForm({
    defaultValues: {
      title: schema?.title ?? '',
      allowNotes: schema?.allowNotes ?? false,
      fields: schema ? fieldsFromApi(schema.fields) : [{ ...newField(), type: 'number', required: true, unit: 'in' }],
    },
    resolver: contractResolver(FormSchemaInput, (/** @type {any} */ v) => body(v)),
  })
  const watched = /** @type {any[]} */ (useWatch({ control: form.control, name: 'fields' }) ?? [])
  const allowNotes = Boolean(useWatch({ control: form.control, name: 'allowNotes' }))

  /** @param {any} v */
  function body(v) {
    return prune({
      title: v.title,
      allowNotes: v.allowNotes,
      fields: fieldsToApi(v.fields ?? []),
    })
  }

  async function save() {
    try {
      const doc = body(form.getValues())
      if (schema) await update.mutateAsync({ id: schema.id, body: { ...doc, version: schema.version } })
      else await create.mutateAsync(doc)
      toast.push({ title: 'Form saved', tone: 'success' })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <FormDrawer open title={schema ? `Edit ${schema.title}` : 'New custom-size form'} onClose={onClose} formId="form-schema-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="title" label="Title" required>
        {(field) => <Input {...field} maxLength={100} required />}
      </RHFField>
      <FormFieldsEditor control={form.control} max={30} />
      <Controller control={form.control} name="allowNotes" render={({ field }) => <Checkbox label='Add an "Anything else?" box for the customer' checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
      <Preview fields={watched} allowNotes={allowNotes} />
    </FormDrawer>
  )
}

/** The "Custom-size forms" tab. */
export function FormSchemasTab() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useFormSchemaMutations()
  const { data } = useSuspenseQuery(formSchemasQuery)
  const items = /** @type {FormSchemaRow[]} */ (/** @type {unknown} */ (data.items))
  const [deleting, setDeleting] = useState(/** @type {FormSchemaRow | null} */ (null))
  const editing = drawer.editing ? (items.find((f) => f.id === drawer.editing) ?? null) : null

  return (
    <div className="space-y-4 pt-4">
      {can('catalog:write') ? (
        <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>
          New custom-size form
        </Button>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No custom-size forms yet" body="Made-to-order products ask the customer for measurements with one of these." />
      ) : (
        <Table label="Custom-size forms">
          <caption className="sr-only">Custom-size forms</caption>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th numeric>Fields</Th>
              <Th numeric>Used by</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id}>
                <Td>
                  <button type="button" className="font-medium hover:underline" onClick={() => drawer.edit(f.id)}>
                    {f.title}
                  </button>
                </Td>
                <Td numeric>{f.fields.length}</Td>
                <Td numeric>{f.usedBy === 1 ? '1 product' : `${f.usedBy} products`}</Td>
                <Td>
                  <Menu
                    align="end"
                    trigger={<IconButton label={`Actions for ${f.title}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                    items={[
                      { label: can('catalog:write') ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(f.id) },
                      ...(can('catalog:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setDeleting(f) }] : []),
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {drawer.isOpen && (drawer.creating !== null || editing) ? <FormSchemaDrawer key={drawer.editing ?? 'new'} schema={editing} onClose={drawer.close} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title ?? ''}?`}
        body="This cannot be undone. A form that products use cannot be deleted. Measurements already stored on orders are not affected."
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
