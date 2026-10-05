import { enums } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { sizeSystemsQuery } from '@/lib/catalog'
import { newKey, valueIsLocked } from '../variants'

const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const roles = enums.optionRole.map((v) => ({ value: v, label: humanise(v) }))
const displays = enums.optionDisplay.map((v) => ({ value: v, label: humanise(v) }))

/**
 * One option: its name, role and display, and its values (picked from a size system, or typed).
 * @param {{ index: number; onRemove: () => void; }} props
 */
function OptionRow({ index, onRemove }) {
  const { control, setValue, getValues } = useFormContext()
  const { data: systems } = useSuspenseQuery(sizeSystemsQuery)
  const base = /** @type {`options.${number}`} */ (`options.${index}`)
  const role = useWatch({ control, name: `${base}.role` })
  const systemId = useWatch({ control, name: `${base}.sizeSystemId` })
  const styleId = useWatch({ control, name: 'styleId' })
  const values = /** @type {any[]} */ (useWatch({ control, name: `${base}.values` }) ?? [])
  const variants = /** @type {any[]} */ (useWatch({ control, name: 'variants' }) ?? [])
  const values$ = useFieldArray({ control, name: `${base}.values`, keyName: 'rid' })
  const system = systems.items.find((s) => s.id === systemId)

  /** Takes a size in or out; the values stay in the order of the size system. @param {{ id: string; label: string; }} size @param {boolean} on */
  const toggleSize = (size, on) => {
    const current = /** @type {any[]} */ (getValues(`${base}.values`) ?? [])
    const next = (system?.values ?? []).flatMap((/** @type {{ id: string; label: string; }} */ s) => {
      const have = current.find((v) => v.sizeSystemValueId === s.id)
      if (s.id === size.id) return on ? [have ?? { key: newKey(), label: s.label, kind: 'standard', sizeSystemValueId: s.id }] : []
      return have ? [have] : []
    })
    setValue(`${base}.values`, next, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <fieldset className="space-y-3 rounded-card border border-line p-3">
      <legend className="px-1 text-sm font-medium">Option {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <RHFField control={control} name={`${base}.name`} label="Name" required>
          {(field) => <Input {...field} maxLength={40} required />}
        </RHFField>
        <RHFField control={control} name={`${base}.role`} label="Role" hint={styleId ? 'A product in a colourway group cannot have a colour option.' : undefined}>
          {(field) => <NativeSelect {...field} options={roles.map((r) => (r.value === 'color' && styleId ? { ...r, disabled: true } : r))} />}
        </RHFField>
        <RHFField control={control} name={`${base}.display`} label="Shown as">
          {(field) => <NativeSelect {...field} options={displays} />}
        </RHFField>
      </div>

      {role === 'size' ? (
        <>
          <RHFField control={control} name={`${base}.sizeSystemId`} label="Size system" required>
            {(field) => (
              <NativeSelect
                {...field}
                value={field.value ?? ''}
                placeholder="Choose a size system"
                options={systems.items.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(e) => {
                  field.onChange(e)
                  setValue(`${base}.values`, [], { shouldDirty: true })
                }}
              />
            )}
          </RHFField>
          {system ? (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="mb-1 text-sm font-medium">Sizes</legend>
              {system.values.map((/** @type {{ id: string; label: string; }} */ s) => {
                const on = values.some((v) => v.sizeSystemValueId === s.id)
                const locked = on && valueIsLocked(variants, values.find((v) => v.sizeSystemValueId === s.id)?.key)
                return <Checkbox key={s.id} label={s.label} checked={on} disabled={locked} onCheckedChange={(next) => toggleSize(s, next)} />
              })}
            </fieldset>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Values</p>
          {values$.fields.map((f, i) => (
            <div key={f.rid} className="flex items-center gap-2">
              <RHFField control={control} name={`${base}.values.${i}.label`} label={`Value ${i + 1}`} className="flex-1">
                {(field) => <Input {...field} maxLength={40} />}
              </RHFField>
              <IconButton
                label={`Remove value ${i + 1}`}
                icon={<X aria-hidden className="size-4" />}
                disabled={valueIsLocked(variants, values[i]?.key)}
                title={valueIsLocked(variants, values[i]?.key) ? 'A variant with orders uses this value' : undefined}
                onClick={() => values$.remove(i)}
              />
            </div>
          ))}
          {values$.fields.length < 30 ? (
            <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => values$.append({ key: newKey(), label: '', kind: 'standard' })}>
              Add a value
            </Button>
          ) : null}
        </div>
      )}
      <Button variant="ghost" size="sm" iconStart={<Trash2 aria-hidden className="size-4" />} onClick={onRemove}>
        Remove this option
      </Button>
    </fieldset>
  )
}

/** The product's options (up to three). */
export function OptionsEditor() {
  const { control } = useFormContext()
  const options = useFieldArray({ control, name: 'options', keyName: 'rid' })
  return (
    <div className="space-y-3">
      {options.fields.map((f, i) => (
        <OptionRow key={f.rid} index={i} onRemove={() => options.remove(i)} />
      ))}
      {options.fields.length < 3 ? (
        <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => options.append({ name: '', role: 'other', display: 'buttons', values: [{ key: newKey(), label: '', kind: 'standard' }] })}>
          Add an option
        </Button>
      ) : null}
    </div>
  )
}
