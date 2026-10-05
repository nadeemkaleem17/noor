import { Checkbox } from '@noor/ui/checkbox'
import { Field } from '@noor/ui/field'
import { NumberInput } from '@noor/ui/number-input'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { attributesOf, attributesQuery, categoriesQuery } from '@/lib/catalog'

/**
 * One control per attribute of the primary category's filter set (plan/07-admin/03-products.md section 4): values come from the attribute's own list, never free text.
 * The list follows the category; values of attributes the category no longer uses are left as they are.
 */
export function AttributesSection() {
  const { control } = useFormContext()
  const categoryId = useWatch({ control, name: 'primaryCategoryId' })
  const { data: categories } = useSuspenseQuery(categoriesQuery)
  const { data: attributes } = useSuspenseQuery(attributesQuery)
  const wanted = categoryId ? attributesOf(/** @type {any} */ (categories.items), categoryId) : []
  const defs = wanted.flatMap((w) => {
    const def = attributes.items.find((a) => a.id === w.attributeId)
    return def ? [{ def, required: w.required }] : []
  })
  if (defs.length === 0) return null
  return (
    <SectionCard id="attributes" title="Attributes" description="Used for the shop's filters.">
      <Controller
        control={control}
        name="attributes"
        render={({ field }) => {
          const list = /** @type {{ attributeId: string; valueIds?: string[]; number?: number; }[]} */ (field.value ?? [])
          /** @param {string} attributeId @param {{ valueIds?: string[]; number?: number; }} patch */
          const set = (attributeId, patch) => {
            const rest = list.filter((a) => a.attributeId !== attributeId)
            const merged = /** @type {{ attributeId: string; valueIds?: string[]; number?: number; }} */ ({ attributeId, ...patch })
            field.onChange(('valueIds' in merged && merged.valueIds?.length === 0) || ('number' in merged && merged.number === undefined) ? rest : [...rest, merged])
          }
          return (
            <div className="space-y-4">
              {defs.map(({ def, required }) => {
                const current = list.find((a) => a.attributeId === def.id)
                if (def.type === 'number') {
                  return (
                    <Field key={def.id} label={def.label} required={required}>
                      <NumberInput name={`attributes.${def.code}`} aria-label={def.label} min={0} value={current?.number ?? null} onValueChange={(n) => set(def.id, { number: n ?? undefined })} />
                    </Field>
                  )
                }
                return (
                  <fieldset key={def.id} className="space-y-2" name={`attributes.${def.code}`} tabIndex={-1}>
                    <legend className="text-sm font-medium">
                      {def.label}
                      {required ? <span aria-hidden className="text-danger"> *</span> : null}
                    </legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {def.values.map((/** @type {{ id: string; label: string; }} */ v) => {
                        const on = current?.valueIds?.includes(v.id) ?? false
                        return (
                          <Checkbox
                            key={v.id}
                            label={v.label}
                            checked={on}
                            onCheckedChange={(next) => set(def.id, { valueIds: next ? [...(current?.valueIds ?? []), v.id] : (current?.valueIds ?? []).filter((x) => x !== v.id) })}
                          />
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )
        }}
      />
    </SectionCard>
  )
}
