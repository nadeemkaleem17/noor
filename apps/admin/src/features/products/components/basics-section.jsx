import { Markdown } from '@noor/ui/markdown'
import { Input } from '@noor/ui/input'
import { RHFField } from '@noor/ui/field'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { env } from '@/lib/env'
import { slugify } from '@/lib/slug'

/**
 * Title, subtitle, brand and the Markdown description with a preview (plan/07-admin/03-products.md section 4).
 * @param {{ suggestHandle: boolean; }} props - a new product gets its handle from the title until someone edits the handle
 */
export function BasicsSection({ suggestHandle }) {
  const { control, setValue, getValues, formState } = useFormContext()
  const [preview, setPreview] = useState(false)
  const description = useWatch({ control, name: 'descriptionMd' })
  return (
    <SectionCard id="basics" title="Basics">
      <RHFField control={control} name="title" label="Title" required>
        {(field) => (
          <Input
            {...field}
            maxLength={120}
            required
            onChange={(e) => {
              // the handle follows the title while it is still what the title would have produced
              const follows = suggestHandle && (getValues('handle') === '' || getValues('handle') === slugify(getValues('title') ?? ''))
              field.onChange(e)
              if (follows) setValue('handle', slugify(e.target.value), { shouldValidate: formState.isSubmitted })
            }}
          />
        )}
      </RHFField>
      <RHFField control={control} name="subtitle" label="Subtitle">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={160} />}
      </RHFField>
      <RHFField control={control} name="brand" label="Brand">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
      </RHFField>
      <div className="space-y-2">
        <Switch label="Preview the description" checked={preview} onCheckedChange={setPreview} />
        {preview ? (
          <div className="min-h-24 rounded-control border border-line p-3">{description ? <Markdown source={description} imageOrigin={`${env.apiUrl}/img`} /> : <p className="text-sm text-muted">Nothing to preview yet.</p>}</div>
        ) : (
          <RHFField control={control} name="descriptionMd" label="Description" hint="Markdown: **bold**, lists, links. At most 5,000 characters.">
            {(field) => <Textarea {...field} value={field.value ?? ''} rows={6} maxLength={5000} />}
          </RHFField>
        )}
      </div>
    </SectionCard>
  )
}
