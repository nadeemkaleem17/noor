import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Textarea } from '@noor/ui/textarea'
import { useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { slugify } from '@/lib/slug'

/**
 * The handle (the product's address) and the search-engine title and description (plan/07-admin/03-products.md section 4).
 * @param {{ published: boolean; }} props - a published product's old address redirects when the handle changes
 */
export function SeoSection({ published }) {
  const { control, setValue, getValues, formState } = useFormContext()
  const seoTitle = useWatch({ control, name: 'seo.title' })
  const seoDescription = useWatch({ control, name: 'seo.description' })
  const title = useWatch({ control, name: 'title' })
  const handle = useWatch({ control, name: 'handle' })
  const handleChanged = published && formState.dirtyFields.handle
  return (
    <SectionCard id="seo" title="Search and address">
      <RHFField
        control={control}
        name="handle"
        label="Handle"
        required
        hint={handleChanged ? 'The old link will redirect to the new one.' : "Lowercase letters, numbers and dashes. It is the end of the product's web address."}
      >
        {(field) => (
          <div className="flex gap-2">
            <Input {...field} maxLength={70} required />
            <Button variant="secondary" onClick={() => setValue('handle', slugify(getValues('title') ?? ''), { shouldDirty: true, shouldValidate: true })}>
              Regenerate from title
            </Button>
          </div>
        )}
      </RHFField>
      <RHFField control={control} name="seo.title" label="Search title" hint="Up to 60 characters. Leave empty to use the product title.">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
      </RHFField>
      <RHFField control={control} name="seo.description" label="Search description" hint="Up to 160 characters.">
        {(field) => <Textarea {...field} value={field.value ?? ''} rows={2} maxLength={160} />}
      </RHFField>
      <div aria-label="Search result preview" role="group" className="rounded-control bg-surface-2 p-3 text-sm">
        <p className="text-accent-text">{seoTitle || title || 'Product title'}</p>
        <p className="text-muted">rubaya.pk/p/{handle || 'handle'}</p>
        <p>{seoDescription || 'The description search engines show under the title.'}</p>
      </div>
    </SectionCard>
  )
}
