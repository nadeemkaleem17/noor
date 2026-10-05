import { Controller, useFormContext } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { ProductPicker } from './product-picker'

/** "You may also like": up to eight products chosen by hand. @param {{ productId?: string; }} props */
export function RelatedSection({ productId }) {
  const { control } = useFormContext()
  return (
    <SectionCard id="related" title="Related products" description="Shown under the product. Up to 8.">
      <Controller control={control} name="relatedIds" render={({ field }) => <ProductPicker label="Related products" value={field.value ?? []} onChange={field.onChange} max={8} excludeId={productId} />} />
    </SectionCard>
  )
}
