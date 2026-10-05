import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useWatch } from 'react-hook-form'
import { slugify } from '@/lib/slug'

const fieldTypes = ['text', 'tel', 'email', 'number', 'select', 'textarea', 'checkbox'].map((v) => ({ value: v, label: v.replace(/^./, (c) => c.toUpperCase()) }))

/** A field key from its label: "Bust size" gives bustSize. @param {string} label */
export const keyFrom = (label) => {
  const words = slugify(label).split('-').filter(Boolean)
  return words.map((w, i) => (i === 0 ? w : w.replace(/^./, (c) => c.toUpperCase()))).join('').replace(/^[^a-z]+/, '').slice(0, 30)
}

/** A new field for the editor. */
export const newField = () => ({ key: '', label: '', type: 'text', required: false, optionsText: '', stored: false })

/**
 * The editor's fields as the contract's `FormField`s: keys made from labels where empty, choices turned into options, number settings only on number fields.
 * @param {any[]} fields
 */
export function fieldsToApi(fields) {
  return fields.map((f) => {
    const { optionsText, stored, rid, ...rest } = f
    void stored
    void rid
    const options = f.type === 'select' ? String(optionsText ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((label) => ({ value: slugify(label).replace(/-/g, '_') || label, label })) : undefined
    const base = { ...rest, key: f.key || keyFrom(f.label ?? ''), options }
    return f.type === 'number' ? base : { ...base, unit: undefined, min: undefined, max: undefined, step: undefined }
  })
}

/** The contract's fields as the editor holds them. @param {any[]} fields */
export const fieldsFromApi = (fields) => fields.map((f) => ({ ...f, optionsText: (f.options ?? []).map((/** @type {{ label: string; }} */ o) => o.label).join('\n'), stored: true }))

/**
 * Edits a list of form fields (label, key, type, required, number limits, choices, help text) with reordering. The key of a stored field is fixed.
 * Used by the custom-size forms and the extra checkout fields (plan/07-admin/04-catalog.md section 5.3, plan/07-admin/11-settings.md section 2).
 * @param {{ control: import('react-hook-form').Control<any>; name?: string; max: number; legend?: string; addLabel?: string; }} props
 */
export function FormFieldsEditor({ control, name = 'fields', max, legend = 'Fields', addLabel = 'Add a field' }) {
  const fields = useFieldArray({ control, name, keyName: 'rid' })
  const watched = /** @type {any[]} */ (useWatch({ control, name }) ?? [])
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{legend}</legend>
      {fields.fields.map((f, i) => {
        const type = watched[i]?.type
        const stored = Boolean(/** @type {any} */ (f).stored)
        const at = `${name}.${i}`
        return (
          <div key={f.rid} className="space-y-2 rounded-card border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <RHFField control={control} name={`${at}.label`} label="Label" required>
                {(field) => <Input {...field} maxLength={80} />}
              </RHFField>
              <RHFField control={control} name={`${at}.key`} label="Key" hint={stored ? 'Fixed: stored data uses it.' : 'Made from the label if left empty.'}>
                {(field) => <Input {...field} value={field.value ?? ''} maxLength={30} readOnly={stored} placeholder={keyFrom(watched[i]?.label ?? '')} />}
              </RHFField>
              <RHFField control={control} name={`${at}.type`} label="Type">
                {(field) => <NativeSelect {...field} options={fieldTypes} />}
              </RHFField>
              {type === 'number' ? (
                <RHFField control={control} name={`${at}.unit`} label="Unit">
                  {(field) => (
                    <NativeSelect
                      {...field}
                      value={field.value ?? ''}
                      placeholder="None"
                      options={[
                        { value: 'in', label: 'Inches' },
                        { value: 'cm', label: 'Centimetres' },
                      ]}
                    />
                  )}
                </RHFField>
              ) : null}
            </div>
            {type === 'number' ? (
              <div className="grid grid-cols-3 gap-2">
                {['min', 'max', 'step'].map((k) => (
                  <RHFField key={k} control={control} name={`${at}.${k}`} label={k.replace(/^./, (c) => c.toUpperCase())}>
                    {(field) => <Input name={field.name} ref={field.ref} onBlur={field.onBlur} inputMode="decimal" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} />}
                  </RHFField>
                ))}
              </div>
            ) : null}
            {type === 'select' ? (
              <RHFField control={control} name={`${at}.optionsText`} label="Choices" hint="One per line.">
                {(field) => <Textarea {...field} value={field.value ?? ''} rows={3} />}
              </RHFField>
            ) : null}
            <RHFField control={control} name={`${at}.helpText`} label="Help text">
              {(field) => <Input {...field} value={field.value ?? ''} maxLength={200} />}
            </RHFField>
            <div className="flex flex-wrap items-center gap-2">
              <Controller control={control} name={`${at}.required`} render={({ field }) => <Checkbox label="Required" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
              <span className="ms-auto flex gap-1">
                <IconButton label={`Move field ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => fields.move(i, i - 1)} />
                <IconButton label={`Move field ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === fields.fields.length - 1} onClick={() => fields.move(i, i + 1)} />
                <IconButton label={`Remove field ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => fields.remove(i)} />
              </span>
            </div>
          </div>
        )
      })}
      {fields.fields.length < max ? (
        <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => fields.append(newField())}>
          {addLabel}
        </Button>
      ) : null}
    </fieldset>
  )
}

