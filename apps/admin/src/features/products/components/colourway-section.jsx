import { enums } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { AppLink } from '@/components/app-link'
import { SectionCard } from '@/components/section-card'

const families = enums.colorFamily.map((v) => ({ value: v, label: v.replace(/^./, (c) => c.toUpperCase()) }))
const FALLBACK_HEX = '#888888'

/**
 * Products that differ only in colour share a style id and each has its own colour name, family and swatch (ADR-0014).
 * @param {{ siblings: { id: string; title: string; colorwayLabel: string; status: string; }[]; }} props
 */
export function ColourwaySection({ siblings }) {
  const { control } = useFormContext()
  const styleId = useWatch({ control, name: 'styleId' })
  return (
    <SectionCard id="colourway" title="Colourway" description="Only for products that come in several colours as separate products. Leave the style empty otherwise.">
      <RHFField control={control} name="styleId" label="Style" hint="The same text on every colour of this design, for example embroidered-lawn.">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={80} />}
      </RHFField>
      {styleId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <RHFField control={control} name="colorway.label" label="Colour name" required>
              {(field) => <Input {...field} value={field.value ?? ''} maxLength={40} required />}
            </RHFField>
            <RHFField control={control} name="colorway.family" label="Colour family" required>
              {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="Choose" options={families} />}
            </RHFField>
          </div>
          <Controller
            control={control}
            name="colorway.swatch"
            defaultValue={{ hex: [FALLBACK_HEX] }}
            render={({ field }) => {
              const hex = /** @type {string[]} */ (field.value?.hex ?? [FALLBACK_HEX])
              return (
                <Field label="Swatch" hint="One colour, or two for a two-tone piece.">
                  <div className="flex items-center gap-2">
                    {hex.map((h, i) => (
                      <input key={i} type="color" aria-label={`Swatch colour ${i + 1}`} value={h} className="h-10 w-14 rounded-control border border-line" onChange={(e) => field.onChange({ hex: hex.map((x, j) => (j === i ? e.target.value : x)) })} />
                    ))}
                    {hex.length < 2 ? (
                      <Button variant="secondary" size="sm" onClick={() => field.onChange({ hex: [...hex, FALLBACK_HEX] })}>
                        Add a second colour
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => field.onChange({ hex: hex.slice(0, 1) })}>
                        Remove the second colour
                      </Button>
                    )}
                  </div>
                </Field>
              )
            }}
          />
        </>
      ) : null}
      {siblings.length ? (
        <div>
          <p className="text-sm font-medium">Other colours of this style</p>
          <ul className="mt-1 list-disc ps-5 text-sm">
            {siblings.map((s) => (
              <li key={s.id}>
                <AppLink to={`/products/${s.id}`}>{`${s.title} (${s.colorwayLabel})`}</AppLink> <span className="text-muted">{s.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  )
}
