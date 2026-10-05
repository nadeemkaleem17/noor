import { Controller, useFormContext } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { StringList } from '@/components/string-list'

/** Highlights (up to 6) and care instructions (up to 8). */
export function DetailsSection() {
  const { control } = useFormContext()
  return (
    <SectionCard id="details" title="Details">
      <Controller control={control} name="highlights" render={({ field }) => <StringList label="Highlights" value={field.value} onChange={field.onChange} max={6} maxLength={120} addLabel="Add a highlight" />} />
      <Controller control={control} name="care" render={({ field }) => <StringList label="Care instructions" value={field.value} onChange={field.onChange} max={8} maxLength={120} addLabel="Add a care line" />} />
    </SectionCard>
  )
}
