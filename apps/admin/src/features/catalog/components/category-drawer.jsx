import { ApiError, CategoryInput } from '@noor/contract'
import { IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Field, RHFField } from '@noor/ui/field'
import { ImageUpload } from '@noor/ui/image-upload'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { FormDrawer } from '@/components/form-drawer'
import { api } from '@/lib/api'
import { attributesQuery, categoriesQuery, categoryOptions } from '@/lib/catalog'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { slugify } from '@/lib/slug'
import { uploadErrorText, uploadImage } from '@/lib/upload'
import { useCategoryMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCategory>} Category */

const empty = () => ({ name: '', handle: '', parentId: '', description: '', visible: true, attributes: [], seo: { title: '', description: '' } })

/** The depth of a category: 1 at the top. @param {Category[]} all @param {string} id */
function depthOf(all, id) {
  let depth = 1
  for (let c = all.find((x) => x.id === id); c?.parentId; c = all.find((x) => x.id === c?.parentId)) depth++
  return depth
}

/** `id` and every category below it. @param {Category[]} all @param {string} id */
function subtree(all, id) {
  const ids = [id]
  for (let i = 0; i < ids.length; i++) for (const c of all) if (c.parentId === ids[i]) ids.push(c.id)
  return ids
}

/**
 * Which attributes a category shows as filters, in facet order, and which of them are indexable or required (plan/07-admin/04-catalog.md section 2).
 * @param {{ value: { attributeId: string; seoIndexable: boolean; required: boolean; }[]; onChange: (v: { attributeId: string; seoIndexable: boolean; required: boolean; }[]) => void; }} props
 */
function FilterSet({ value, onChange }) {
  const { data } = useSuspenseQuery(attributesQuery)
  const filterable = data.items.filter((a) => a.filterable)
  const chosen = value.flatMap((v) => {
    const def = filterable.find((a) => a.id === v.attributeId)
    return def ? [{ ...v, label: def.label }] : []
  })
  const move = (/** @type {number} */ i, /** @type {number} */ to) => {
    const next = [...value]
    const [item] = next.splice(i, 1)
    if (item) next.splice(to, 0, item)
    onChange(next)
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Filters shown</legend>
      <p className="text-sm text-muted">In this order on the shop. Leave all unticked to use the parent category&apos;s filters.</p>
      <ul className="space-y-1">
        {chosen.map((c, i) => (
          <li key={c.attributeId} className="flex flex-wrap items-center gap-3 rounded-control border border-line px-2 py-1">
            <span className="min-w-24 flex-1 text-sm font-medium">{c.label}</span>
            <Checkbox label="Indexable" checked={c.seoIndexable} onCheckedChange={(on) => onChange(value.map((v) => (v.attributeId === c.attributeId ? { ...v, seoIndexable: on } : v)))} />
            <Checkbox label="Required" checked={c.required} onCheckedChange={(on) => onChange(value.map((v) => (v.attributeId === c.attributeId ? { ...v, required: on } : v)))} />
            <IconButton label={`Move ${c.label} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => move(i, i - 1)} />
            <IconButton label={`Move ${c.label} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === chosen.length - 1} onClick={() => move(i, i + 1)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {filterable.map((a) => (
          <Checkbox
            key={a.id}
            label={a.label}
            checked={value.some((v) => v.attributeId === a.id)}
            onCheckedChange={(on) => onChange(on ? [...value, { attributeId: a.id, seoIndexable: false, required: false }] : value.filter((v) => v.attributeId !== a.id))}
          />
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The category form in a drawer: create (`category` null, optional starting parent) or edit.
 * @param {{ open: boolean; category: Category | null; parentId?: string; onClose: () => void; }} props
 */
export function CategoryDrawer({ open, category, parentId = '', onClose }) {
  const { data: categories } = useSuspenseQuery(categoriesQuery)
  const all = /** @type {Category[]} */ (/** @type {unknown} */ (categories.items))
  const { create, update } = useCategoryMutations()
  const toast = useToast()
  const [image, setImage] = useState(/** @type {{ id: string; src: string; alt: string; } | null} */ (category?.image && category.imageMediaId ? { id: category.imageMediaId, src: category.image.src, alt: category.image.alt } : null))
  const [imageAltBefore] = useState(image?.alt ?? '')
  const form = useForm({
    defaultValues: category
      ? { ...empty(), ...Object.fromEntries(Object.entries(category).filter(([k]) => ['name', 'handle', 'description', 'visible', 'attributes', 'seo'].includes(k))), parentId: category.parentId ?? '', seo: { title: category.seo?.title ?? '', description: category.seo?.description ?? '' } }
      : { ...empty(), parentId },
    resolver: contractResolver(CategoryInput, (/** @type {any} */ v) => body(v, image)),
  })

  /** The document the API accepts: no empty strings, `parentId` null for the top level. @param {any} values @param {{ id: string; } | null} img */
  function body(values, img) {
    return { ...prune({ ...values, parentId: undefined }), parentId: values.parentId || null, imageMediaId: img?.id ?? null }
  }

  // a category may not move under itself or its own descendants, and the tree is at most three levels deep
  const blocked = category ? new Set(subtree(all, category.id)) : new Set()
  const parents = categoryOptions(all).filter((o) => !blocked.has(o.value) && depthOf(all, o.value) < 3)

  async function save() {
    try {
      const doc = body(form.getValues(), image)
      if (image && image.alt !== imageAltBefore) await api('admin.media.update', { params: { id: image.id }, body: { alt: image.alt } })
      if (category) await update.mutateAsync({ id: category.id, body: /** @type {never} */ ({ ...doc, version: category.version }) })
      else await create.mutateAsync(/** @type {never} */ (doc))
      toast.push({ title: 'Category saved', tone: 'success' })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <FormDrawer open={open} title={category ? `Edit ${category.name}` : 'New category'} onClose={onClose} formId="category-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="name" label="Name" required>
        {(field) => (
          <Input
            {...field}
            maxLength={60}
            required
            onChange={(e) => {
              const follows = !category && (form.getValues('handle') === '' || form.getValues('handle') === slugify(form.getValues('name')))
              field.onChange(e)
              if (follows) form.setValue('handle', slugify(e.target.value))
            }}
          />
        )}
      </RHFField>
      <RHFField control={form.control} name="handle" label="Handle" required hint={category ? 'Changing it keeps the old link working with a redirect.' : undefined}>
        {(field) => <Input {...field} maxLength={70} required />}
      </RHFField>
      <RHFField control={form.control} name="parentId" label="Parent">
        {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="None (top level)" options={parents} />}
      </RHFField>
      <RHFField control={form.control} name="description" label="Description" hint="Shown above the products of the category.">
        {(field) => <Textarea {...field} value={field.value ?? ''} rows={3} maxLength={600} />}
      </RHFField>
      <Field label="Image" hint="Used on the home page tiles.">
        <div className="space-y-2">
          <ImageUpload
            value={image ? [{ id: image.id, src: image.src, alt: image.alt }] : []}
            maxFiles={1}
            onChange={(list) => {
              const last = list.at(-1)
              setImage(last ? { id: last.id, src: last.src, alt: last.alt ?? '' } : null)
            }}
            upload={(file) => uploadImage(file)}
            describeError={uploadErrorText}
          />
          {image ? <Input aria-label="Image alt text" placeholder="Alt text: describe the picture" value={image.alt} maxLength={300} onChange={(e) => setImage({ ...image, alt: e.target.value })} /> : null}
        </div>
      </Field>
      <Controller control={form.control} name="attributes" render={({ field }) => <FilterSet value={field.value ?? []} onChange={field.onChange} />} />
      <RHFField control={form.control} name="seo.title" label="Search title" hint="Up to 60 characters.">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
      </RHFField>
      <RHFField control={form.control} name="seo.description" label="Search description" hint="Up to 160 characters.">
        {(field) => <Textarea {...field} value={field.value ?? ''} rows={2} maxLength={160} />}
      </RHFField>
      <Controller
        control={form.control}
        name="visible"
        render={({ field }) => <Switch label="Visible in the shop" checked={Boolean(field.value)} onCheckedChange={field.onChange} />}
      />
    </FormDrawer>
  )
}
