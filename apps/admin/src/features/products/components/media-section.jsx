import { enums } from '@noor/contract'
import { IconButton } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { ImageUpload } from '@noor/ui/image-upload'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useToast } from '@noor/ui/toast'
import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { uploadErrorText, uploadImage } from '../upload'

const roles = enums.mediaRole.map((v) => ({ value: v, label: v.replace(/^./, (c) => c.toUpperCase()) }))
const maxImages = 12

/**
 * The gallery (plan/07-admin/03-products.md section 6): upload, order, alt text, role, and the option value a picture is shown for.
 * The first picture is the card image. Dragging to reorder is not built; the buttons do the same.
 * @param {{ onBusyChange: (busy: boolean) => void; }} props - the form cannot be saved while a file is being sent
 */
export function MediaSection({ onBusyChange }) {
  const { control } = useFormContext()
  const toast = useToast()
  const media = useFieldArray({ control, name: 'media', keyName: 'rid' })
  const items = /** @type {any[]} */ (useWatch({ control, name: 'media' }) ?? [])
  const options = /** @type {any[]} */ (useWatch({ control, name: 'options' }) ?? [])
  const valueOptions = options.flatMap((o) => (o.values ?? []).filter((/** @type {any} */ v) => v.label).map((/** @type {any} */ v) => ({ value: v.key, label: `${o.name || 'Option'}: ${v.label}` })))

  return (
    <SectionCard id="media" title="Media" description={`1 to ${maxImages} pictures: JPEG, PNG, WebP or AVIF, up to 10 MB, at least 1200 pixels on the long side. The first one is the card picture.`}>
      <ul className="space-y-3">
        {media.fields.map((f, i) => {
          const src = items[i]?.image?.src
          return (
            <li key={f.rid} className="grid gap-3 rounded-card border border-line p-3 sm:grid-cols-[6rem_1fr_auto]">
              {src ? <img src={src} alt="" className="size-24 rounded-media object-cover" /> : <div className="size-24 rounded-media bg-surface-2" />}
              <div className="grid gap-3 sm:grid-cols-3">
                <RHFField control={control} name={`media.${i}.alt`} label="Alt text" hint="Describes the picture; needed to publish." className="sm:col-span-3">
                  {(field) => <Input {...field} value={field.value ?? ''} maxLength={300} />}
                </RHFField>
                <RHFField control={control} name={`media.${i}.role`} label="Kind of picture">
                  {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="Not set" options={roles} />}
                </RHFField>
                {valueOptions.length ? (
                  <RHFField control={control} name={`media.${i}.optionValueKey`} label="Shown for" className="sm:col-span-2">
                    {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="All variants" options={valueOptions} />}
                  </RHFField>
                ) : null}
              </div>
              <div className="flex gap-1 sm:flex-col">
                <IconButton label={`Make picture ${i + 1} the main one`} icon={<Star aria-hidden className="size-4" />} disabled={i === 0} onClick={() => media.move(i, 0)} />
                <IconButton label={`Move picture ${i + 1} earlier`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => media.move(i, i - 1)} />
                <IconButton label={`Move picture ${i + 1} later`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === media.fields.length - 1} onClick={() => media.move(i, i + 1)} />
                <IconButton label={`Remove picture ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => media.remove(i)} />
              </div>
            </li>
          )
        })}
      </ul>
      {media.fields.length < maxImages ? (
        <ImageUpload
          multiple
          value={[]}
          maxFiles={maxImages - media.fields.length}
          label="Drop pictures here or choose files"
          upload={(file) => uploadImage(file, (note) => toast.push({ title: note, tone: 'warning' }))}
          describeError={uploadErrorText}
          onBusyChange={onBusyChange}
          onChange={(uploaded) => {
            const have = new Set(/** @type {any[]} */ (items).map((m) => m.mediaId))
            for (const u of uploaded) if (!have.has(u.id)) media.append({ mediaId: u.id, alt: '', image: { src: u.src } })
          }}
        />
      ) : (
        <p className="text-sm text-muted">The most pictures a product can have is {maxImages}.</p>
      )}
    </SectionCard>
  )
}
