import { ApiError, AttributeInput, enums } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Switch } from '@noor/ui/switch'
import { useToast } from '@noor/ui/toast'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormDrawer } from '@/components/form-drawer'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { slugify } from '@/lib/slug'
import { useAttributeMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminAttribute>} Attribute */

const humanise = (/** @type {string} */ v) => v.replace(/^./, (c) => c.toUpperCase())
const types = enums.attributeType.map((v) => ({ value: v, label: humanise(v) }))
/** Which displays make sense for a type (the contract rejects the others). @param {string} type */
const displaysFor = (type) =>
  enums.attributeDisplay.filter((d) => (d === 'range' ? type === 'number' : d === 'swatch' ? type === 'color' : type !== 'number')).map((v) => ({ value: v, label: humanise(v) }))

/** Dropdown value codes use underscores: "Pure cotton" gives pure_cotton. @param {string} label */
const codeFrom = (label) => slugify(label).replace(/-/g, '_').slice(0, 40)

/**
 * Moves every product of one value to another and lets the first go (plan/07-admin/04-catalog.md section 4).
 * @param {{ attribute: Attribute; value: { id?: string; label: string; }; onClose: () => void; }} props
 */
function MergeDialog({ attribute, value, onClose }) {
  const { merge } = useAttributeMutations()
  const toast = useToast()
  const [into, setInto] = useState('')
  const others = attribute.values.filter((v) => v.id !== value.id)
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Merge ${value.label} into…`}
      description="Every product with this value gets the other one instead. The value is then free to delete."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!into}
            loading={merge.isPending}
            onClick={() =>
              merge.mutate(
                { id: attribute.id, valueId: /** @type {string} */ (value.id), intoValueId: into },
                { onSuccess: () => (toast.push({ title: 'Values merged', tone: 'success' }), onClose()), onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) },
              )
            }
          >
            Merge
          </Button>
        </>
      }
    >
      <Field label="Merge into">
        <NativeSelect placeholder="Choose a value" options={others.map((v) => ({ value: v.id, label: v.label }))} value={into} onChange={(e) => setInto(e.target.value)} />
      </Field>
    </Dialog>
  )
}

/**
 * The attribute form in a drawer. The key and the type are fixed once created: the key is the `attr.<key>` address parameter.
 * @param {{ open: boolean; attribute: Attribute | null; groups: string[]; onClose: () => void; }} props
 */
export function AttributeDrawer({ open, attribute, groups, onClose }) {
  const { create, update } = useAttributeMutations()
  const toast = useToast()
  const [merging, setMerging] = useState(/** @type {{ id?: string; label: string; } | null} */ (null))
  const form = useForm({
    defaultValues: attribute
      ? { code: attribute.code, label: attribute.label, type: attribute.type, display: attribute.display, filterable: attribute.filterable, group: attribute.group ?? '', values: attribute.values.map((v) => ({ id: v.id, code: v.code, label: v.label, swatch: v.swatch, used: v.usedByProducts })) }
      : { code: '', label: '', type: 'enum', display: 'checkbox', filterable: true, group: '', values: [] },
    resolver: contractResolver(AttributeInput, (/** @type {any} */ v) => body(v)),
  })
  const values = useFieldArray({ control: form.control, name: 'values', keyName: 'rid' })
  const type = /** @type {string} */ (useWatch({ control: form.control, name: 'type' }))
  const fixedValues = type === 'number' || type === 'boolean' // the server supplies these

  /** @param {any} v @returns {object} */
  function body(v) {
    const fixed = v.type === 'number' || v.type === 'boolean'
    return prune({ ...v, values: fixed ? [] : (v.values ?? []).map((/** @type {any} */ x) => ({ id: x.id, code: x.code || codeFrom(x.label ?? ''), label: x.label, swatch: x.swatch })) })
  }

  async function save() {
    try {
      const doc = /** @type {never} */ (body(form.getValues()))
      if (attribute) await update.mutateAsync({ id: attribute.id, body: doc })
      else await create.mutateAsync(doc)
      toast.push({ title: 'Attribute saved', tone: 'success' })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <>
      <FormDrawer open={open} title={attribute ? `Edit ${attribute.label}` : 'New attribute'} onClose={onClose} formId="attribute-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
        <RHFField control={form.control} name="label" label="Label" required>
          {(field) => (
            <Input
              {...field}
              maxLength={60}
              required
              onChange={(e) => {
                const follows = !attribute && (form.getValues('code') === '' || form.getValues('code') === codeFrom(form.getValues('label')).slice(0, 30))
                field.onChange(e)
                if (follows) form.setValue('code', codeFrom(e.target.value).slice(0, 30))
              }}
            />
          )}
        </RHFField>
        <RHFField control={form.control} name="code" label="Key" required hint={attribute ? 'Fixed: it is part of the shop addresses.' : 'Lowercase letters, numbers and underscores. Cannot be changed later.'}>
          {(field) => <Input {...field} maxLength={30} required readOnly={Boolean(attribute)} />}
        </RHFField>
        <div className="grid gap-3 sm:grid-cols-2">
          <RHFField control={form.control} name="type" label="Type" hint={attribute ? 'Fixed once created.' : undefined}>
            {(field) => (
              <NativeSelect
                {...field}
                options={types}
                disabled={Boolean(attribute)}
                onChange={(e) => {
                  field.onChange(e)
                  form.setValue('display', /** @type {never} */ (displaysFor(e.target.value)[0]?.value ?? 'checkbox'))
                }}
              />
            )}
          </RHFField>
          <RHFField control={form.control} name="display" label="Filter display">
            {(field) => <NativeSelect {...field} options={displaysFor(type)} />}
          </RHFField>
        </div>
        <Controller control={form.control} name="filterable" render={({ field }) => <Switch label="Shown as a filter in the shop" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
        <RHFField control={form.control} name="group" label="Group" hint="Groups attributes in the product details, for example Fabric.">
          {(field) => (
            <>
              <Input {...field} value={field.value ?? ''} maxLength={60} list="attribute-groups" />
              <datalist id="attribute-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </>
          )}
        </RHFField>

        {fixedValues ? (
          <p className="text-sm text-muted">The values of a {type === 'number' ? 'number' : 'yes/no'} attribute are set by the shop software.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Values</legend>
            {values.fields.map((f, i) => {
              const used = /** @type {number} */ (/** @type {any} */ (f).used ?? 0)
              return (
                <div key={f.rid} className="space-y-1 rounded-control border border-line p-2">
                  <div className="flex items-end gap-2">
                    <RHFField control={form.control} name={`values.${i}.label`} label={`Value ${i + 1}`} className="flex-1">
                      {(field) => <Input {...field} maxLength={60} />}
                    </RHFField>
                    {type === 'color' ? (
                      <Controller
                        control={form.control}
                        name={`values.${i}.swatch`}
                        defaultValue={{ hex: ['#888888'] }}
                        render={({ field }) => <input type="color" aria-label={`Colour of value ${i + 1}`} className="h-10 w-12 rounded-control border border-line" value={field.value?.hex?.[0] ?? '#888888'} onChange={(e) => field.onChange({ hex: [e.target.value] })} />}
                      />
                    ) : null}
                    <IconButton label={`Move value ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => values.move(i, i - 1)} />
                    <IconButton label={`Move value ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === values.fields.length - 1} onClick={() => values.move(i, i + 1)} />
                    <IconButton
                      label={`Remove value ${i + 1}`}
                      icon={<Trash2 aria-hidden className="size-4" />}
                      disabled={used > 0}
                      title={used > 0 ? `${used} products use this value` : undefined}
                      onClick={() => values.remove(i)}
                    />
                  </div>
                  {used > 0 ? (
                    <p className="text-xs text-muted">
                      Used by {used} {used === 1 ? 'product' : 'products'}.{' '}
                      <Button variant="link" onClick={() => setMerging({ id: /** @type {any} */ (f).id, label: form.getValues(`values.${i}.label`) })}>
                        Merge into…
                      </Button>
                    </p>
                  ) : null}
                </div>
              )
            })}
            <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => values.append({ code: '', label: '' })}>
              Add a value
            </Button>
          </fieldset>
        )}
      </FormDrawer>
      {merging && attribute ? <MergeDialog attribute={attribute} value={merging} onClose={() => setMerging(null)} /> : null}
    </>
  )
}
