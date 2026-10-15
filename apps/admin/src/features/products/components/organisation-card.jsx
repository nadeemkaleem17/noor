import { enums, productBadges } from '@noor/contract'
import { Checkbox } from '@noor/ui/checkbox'
import { RHFField } from '@noor/ui/field'
import { NativeSelect } from '@noor/ui/native-select'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Controller, useFormContext } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { categoriesQuery, categoryOptions } from '@/lib/catalog'

const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const kindOptions = enums.productKind.map((v) => ({ value: v, label: humanise(v) }))

/**
 * A checkbox list that edits an array of strings.
 * @param {{ legend: string; options: { value: string; label: string; }[]; value: string[] | undefined; onChange: (next: string[]) => void; }} props
 */
function CheckList({ legend, options, value = [], onChange }) {
  return (
    <fieldset className="flex flex-col items-start gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {options.map((o) => (
        <Checkbox key={o.value} label={o.label} checked={value.includes(o.value)} onCheckedChange={(on) => onChange(on ? [...value, o.value] : value.filter((v) => v !== o.value))} />
      ))}
    </fieldset>
  )
}

/** Primary category, extra categories, kind and badges. The `sale`, `sold out` and `made to order` badges are worked out by the server. */
export function OrganisationCard() {
  const { control } = useFormContext()
  const { data } = useSuspenseQuery(categoriesQuery)
  const options = categoryOptions(data.items)
  return (
    <SectionCard id="organisation" title="Organisation">
      <RHFField control={control} name="kind" label="Type" required>
        {(field) => <NativeSelect {...field} options={kindOptions} />}
      </RHFField>
      <RHFField control={control} name="primaryCategoryId" label="Primary category" required>
        {(field) => <NativeSelect {...field} placeholder="Choose a category" options={options} />}
      </RHFField>
      <Controller control={control} name="categoryIds" render={({ field }) => <CheckList legend="Also shown in" options={options} value={field.value} onChange={field.onChange} />} />
      <Controller
        control={control}
        name="badges"
        render={({ field }) => <CheckList legend="Badges" options={productBadges.map((b) => ({ value: b, label: humanise(b) }))} value={field.value} onChange={field.onChange} />}
      />
    </SectionCard>
  )
}
