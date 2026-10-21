import { ApiError, CollectionInput } from '@noor/contract'
import { StatusBadge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { Combobox } from '@noor/ui/combobox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { ImageUpload } from '@noor/ui/image-upload'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { Table, Td, Th } from '@noor/ui/table'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronsUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { useBlocker, useNavigate } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { api } from '@/lib/api'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { inUseText, messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { slugify } from '@/lib/slug'
import { useCan } from '@/lib/session'
import { uploadErrorText, uploadImage } from '@/lib/upload'
import { collectionQueries, useCollectionMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCollection>} Collection */
/** @typedef {{ id: string; title: string; status: string; stockStatus: string; image?: { src: string; }; }} Member */

/**
 * `/collections/new` (no id) and `/collections/:id`.
 * @param {{ id?: string; }} props
 */
export function CollectionEditor({ id }) {
  const collection = useQuery({ ...collectionQueries.detail(id ?? ''), enabled: Boolean(id) })
  if (id && collection.isPending) return <Spinner label="Loading the collection" />
  if (id && collection.isError) return <ErrorState title="The collection could not be loaded" retryLabel="Try again" onRetry={() => void collection.refetch()} />
  return <CollectionForm key={collection.data?.id ?? 'new'} collection={collection.data ?? null} />
}

/** @param {{ collection: Collection | null; }} props */
function CollectionForm({ collection }) {
  const isNew = collection === null
  const navigate = useNavigate()
  const toast = useToast()
  const can = useCan()
  const { create, update, remove } = useCollectionMutations()
  const writable = can('catalog:write')
  const [image, setImage] = useState(/** @type {{ id: string; src: string; alt: string; } | null} */ (collection?.image && collection.imageMediaId ? { id: collection.imageMediaId, src: collection.image.src, alt: collection.image.alt } : null))
  const [altBefore] = useState(image?.alt ?? '')
  const [members, setMembers] = useState(/** @type {Member[]} */ (collection ? collection.products.map((p) => ({ id: p.id, title: p.title, status: p.status, stockStatus: p.stockStatus, image: p.image })) : []))
  const [picking, setPicking] = useState(/** @type {string[] | null} */ (null))
  const [replace, setReplace] = useState(/** @type {{ id: string; title: string; }[] | null} */ (null))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const found = useRef(/** @type {Map<string, Member>} */ (new Map()))
  const leaving = useRef(false)

  const form = useForm({
    defaultValues: {
      title: collection?.title ?? '',
      handle: collection?.handle ?? '',
      description: collection?.description ?? '',
      status: collection?.status ?? 'draft',
      featured: collection?.featured ?? false,
      startsAt: collection?.startsAt ?? '',
      endsAt: collection?.endsAt ?? '',
      seo: { title: collection?.seo?.title ?? '', description: collection?.seo?.description ?? '' },
    },
    resolver: contractResolver(CollectionInput, (/** @type {any} */ v) => body(v)),
  })
  const dirty = Object.keys(form.formState.dirtyFields).length > 0 || members.map((m) => m.id).join() !== (collection?.products.map((p) => p.id).join() ?? '') || (image?.id ?? '') !== (collection?.imageMediaId ?? '')
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)

  /** @param {any} v @param {string} [replaceFeaturedId] */
  function body(v, replaceFeaturedId) {
    return {
      ...prune({ ...v, startsAt: v.startsAt || undefined, endsAt: v.endsAt || undefined }),
      imageMediaId: image?.id ?? null,
      productIds: members.map((m) => m.id),
      ...(replaceFeaturedId ? { replaceFeaturedId } : {}),
    }
  }

  /** @param {string} [replaceFeaturedId] */
  async function save(replaceFeaturedId) {
    try {
      const doc = body(form.getValues(), replaceFeaturedId)
      if (image && image.alt !== altBefore) await api('admin.media.update', { params: { id: image.id }, body: { alt: image.alt } })
      const saved = collection ? await update.mutateAsync({ id: collection.id, body: /** @type {never} */ ({ ...doc, version: collection.version }) }) : await create.mutateAsync(/** @type {never} */ (doc))
      toast.push({ title: 'Collection saved', tone: 'success' })
      setReplace(null)
      form.reset(form.getValues())
      if (isNew) {
        leaving.current = true
        void navigate(`/collections/${saved.id}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed' && Array.isArray(error.details.featured)) setReplace(/** @type {{ id: string; title: string; }[]} */ (error.details.featured))
      else if (error instanceof ApiError && error.code === 'stale_write') toast.push({ title: 'Someone else changed this collection. Reload the page to see their version.', tone: 'danger' })
      else if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  /** @param {number} i @param {number} to */
  const move = (i, to) =>
    setMembers((list) => {
      const next = [...list]
      const [item] = next.splice(i, 1)
      if (item) next.splice(to, 0, item)
      return next
    })

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(() => save())(e)} className="space-y-4 pb-20">
        <PageHeader
          title={isNew ? 'New collection' : collection.title}
          actions={
            <>
              {collection && can('catalog:delete') ? (
                <Button variant="secondary" iconStart={<Trash2 aria-hidden className="size-4" />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              ) : null}
              {writable ? (
                <Button type="submit" loading={create.isPending || update.isPending}>
                  Save
                </Button>
              ) : null}
            </>
          }
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <SectionCard id="basics" title="Basics">
              <RHFField control={form.control} name="title" label="Title" required>
                {(field) => (
                  <Input
                    {...field}
                    maxLength={80}
                    required
                    readOnly={!writable}
                    onChange={(e) => {
                      const follows = isNew && (form.getValues('handle') === '' || form.getValues('handle') === slugify(form.getValues('title')))
                      field.onChange(e)
                      if (follows) form.setValue('handle', slugify(e.target.value))
                    }}
                  />
                )}
              </RHFField>
              <RHFField control={form.control} name="handle" label="Handle" required hint="The end of the collection's web address.">
                {(field) => <Input {...field} maxLength={70} required readOnly={!writable} />}
              </RHFField>
              <RHFField control={form.control} name="description" label="Description">
                {(field) => <Textarea {...field} value={field.value ?? ''} rows={3} maxLength={600} readOnly={!writable} />}
              </RHFField>
              <Field label="Image" hint="Shown in the collections row of the home page.">
                <div className="space-y-2">
                  <ImageUpload
                    value={image ? [{ id: image.id, src: image.src, alt: image.alt }] : []}
                    maxFiles={writable ? 1 : 0}
                    onChange={(list) => {
                      const last = list.at(-1)
                      setImage(last ? { id: last.id, src: last.src, alt: last.alt ?? '' } : null)
                    }}
                    upload={(file, control) => uploadImage(file, undefined, undefined, control)}
                    describeError={uploadErrorText}
                  />
                  {image ? <Input aria-label="Image alt text" placeholder="Alt text: describe the picture" value={image.alt} maxLength={300} onChange={(e) => setImage({ ...image, alt: e.target.value })} /> : null}
                </div>
              </Field>
            </SectionCard>

            <SectionCard id="products" title="Products" description="The order here is the order on the collection page.">
              {writable ? (
                <Combobox
                  aria-label="Add a product"
                  placeholder="Search products to add…"
                  emptyText="No products found"
                  value={null}
                  onValueChange={(pid) => {
                    const row = pid ? found.current.get(pid) : undefined
                    if (row && !members.some((m) => m.id === row.id)) setMembers([...members, row])
                  }}
                  onSearch={async (q) => {
                    if (q.trim().length < 2) return []
                    const { items } = await api('admin.products.list', { query: { q: q.trim(), size: 25 } })
                    for (const p of items) found.current.set(p.id, { id: p.id, title: p.title, status: p.status, stockStatus: p.stockStatus, image: p.image })
                    return items.filter((p) => !members.some((m) => m.id === p.id)).map((p) => ({ value: p.id, label: p.title }))
                  }}
                />
              ) : null}
              {members.length === 0 ? (
                <p className="text-sm text-muted">No products yet.</p>
              ) : (
                <Table label="Products in the collection">
                  <caption className="sr-only">Products in the collection</caption>
                  <thead>
                    <tr>
                      <Th>Product</Th>
                      <Th>Status</Th>
                      <Th>Stock</Th>
                      <Th>
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.id}>
                        <Td>
                          <span className="inline-flex items-center gap-2">
                            {m.image ? <img src={m.image.src} alt="" className="size-10 rounded-media object-cover" /> : <span aria-hidden className="size-10 rounded-media bg-surface-2" />}
                            {m.title}
                          </span>
                        </Td>
                        <Td>
                          <StatusBadge status={/** @type {never} */ (m.status)} />
                        </Td>
                        <Td>
                          <StatusBadge status={/** @type {never} */ (m.stockStatus)} />
                        </Td>
                        <Td>
                          {writable ? (
                            <span className="flex gap-1">
                              <IconButton label={`Move ${m.title} to the top`} icon={<ChevronsUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => move(i, 0)} />
                              <IconButton label={`Move ${m.title} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => move(i, i - 1)} />
                              <IconButton label={`Move ${m.title} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === members.length - 1} onClick={() => move(i, i + 1)} />
                              <IconButton label={`Remove ${m.title}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setMembers(members.filter((x) => x.id !== m.id))} />
                            </span>
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </SectionCard>
          </div>
          <aside className="space-y-4" aria-label="Collection settings">
            <SectionCard id="visibility" title="Visibility">
              <RHFField control={form.control} name="status" label="Status" hint="A draft collection's page returns 404.">
                {(field) => (
                  <NativeSelect
                    {...field}
                    disabled={!writable}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                    ]}
                  />
                )}
              </RHFField>
              <Controller control={form.control} name="featured" render={({ field }) => <Switch label="Featured on the home page" disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
              <RHFField control={form.control} name="startsAt" label="Starts" hint="Optional. Pakistan time. Before it, the collection behaves as a draft.">
                {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} readOnly={!writable} value={toLocalInput(field.value || undefined)} onChange={(e) => field.onChange(fromLocalInput(e.target.value) ?? '')} />}
              </RHFField>
              <RHFField control={form.control} name="endsAt" label="Ends" hint="Optional.">
                {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} readOnly={!writable} value={toLocalInput(field.value || undefined)} onChange={(e) => field.onChange(fromLocalInput(e.target.value) ?? '')} />}
              </RHFField>
            </SectionCard>
            <SectionCard id="seo" title="Search">
              <RHFField control={form.control} name="seo.title" label="Search title" hint="Up to 60 characters.">
                {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} readOnly={!writable} />}
              </RHFField>
              <RHFField control={form.control} name="seo.description" label="Search description" hint="Up to 160 characters.">
                {(field) => <Textarea {...field} value={field.value ?? ''} rows={2} maxLength={160} readOnly={!writable} />}
              </RHFField>
            </SectionCard>
          </aside>
        </div>
      </form>

      <Dialog
        open={replace !== null}
        onOpenChange={(open) => !open && setReplace(null)}
        title="Three collections are already featured"
        description="The home page shows three. Choose the one to un-feature."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplace(null)}>
              Cancel
            </Button>
            <Button disabled={picking === null} loading={update.isPending || create.isPending} onClick={() => void save(picking?.[0])}>
              Replace and save
            </Button>
          </>
        }
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Collection to un-feature</legend>
          {(replace ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="radio" name="replace" value={c.id} checked={picking?.[0] === c.id} onChange={() => setPicking([c.id])} />
              {c.title}
            </label>
          ))}
        </fieldset>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${collection?.title ?? ''}?`}
        body="The products stay as they are. It stays in the Trash for 30 days, so it can be put back."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!collection) return
          try {
            await remove.mutateAsync(collection.id)
            leaving.current = true
            void navigate('/collections', { replace: true })
          } catch (error) {
            toast.push({ title: inUseText(error), tone: 'danger' })
            throw error
          }
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        body="Your changes to this collection will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}
