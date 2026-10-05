import { ApiError, PageInput } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Markdown } from '@noor/ui/markdown'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Tabs } from '@noor/ui/tabs'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, ImagePlus, Lock, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form'
import { useBlocker, useNavigate } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { StaleWriteDialog } from '@/components/stale-write-dialog'
import { api } from '@/lib/api'
import { env } from '@/lib/env'
import { inUseText, messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { slugify } from '@/lib/slug'
import { useCan } from '@/lib/session'
import { uploadErrorText, uploadImage } from '@/lib/upload'
import { useDebounced } from '@/lib/use-debounced'
import { pageQueries, usePageMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminPage>} Page */

/** The placeholders a page may contain; the server fills them from the store settings (plan/07-admin/09-content.md section 3.2). */
const tokens = ['store.phone', 'store.email', 'store.whatsapp', 'store.address', 'shipping.freeAbove', 'shipping.fee', 'returns.days']

/**
 * `/content/pages/new` (no id) and `/content/pages/:id`.
 * @param {{ id?: string; }} props
 */
export function PageEditor({ id }) {
  const page = useQuery({ ...pageQueries.detail(id ?? ''), enabled: Boolean(id) })
  if (id && page.isPending) return <Spinner label="Loading the page" />
  if (id && page.isError) return <ErrorState title="The page could not be loaded" retryLabel="Try again" onRetry={() => void page.refetch()} />
  return <PageForm key={page.data?.id ?? 'new'} page={page.data ?? null} />
}

/** The body: Markdown to write, the shop's own renderer to preview, buttons to insert tokens and pictures. @param {{ writable: boolean; }} props */
function BodyField({ writable }) {
  const { control, setValue, getValues } = useFormContext()
  const toast = useToast()
  const body = /** @type {string} */ (useWatch({ control, name: 'bodyMd' }) ?? '')
  const [mode, setMode] = useState('write')
  const area = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [picture, setPicture] = useState(/** @type {{ src: string; width?: number; height?: number; alt: string; } | null} */ (null))
  const file = useRef(/** @type {HTMLInputElement | null} */ (null))
  const settled = useDebounced(mode === 'preview' ? body : '', 400)
  // the server resolves the tokens, so the preview shows what the page will say today
  const preview = useQuery({
    queryKey: ['content', 'preview', settled],
    queryFn: ({ signal }) => api('admin.pages.preview', { body: { bodyMd: settled }, signal }),
    enabled: mode === 'preview' && settled.trim() !== '',
    staleTime: 30_000,
  })

  /** Puts text where the caret is, replacing a selection. @param {string} insert */
  function insertAtCaret(insert) {
    const el = area.current
    const current = String(getValues('bodyMd') ?? '')
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    setValue('bodyMd', current.slice(0, start) + insert + current.slice(end), { shouldDirty: true, shouldValidate: true })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + insert.length, start + insert.length)
    })
  }

  return (
    <div className="space-y-2">
      <Tabs
        aria-label="Body view"
        value={mode}
        onValueChange={setMode}
        items={[
          { value: 'write', label: 'Write' },
          { value: 'preview', label: 'Preview' },
        ]}
      />
      {mode === 'write' ? (
        <>
          {writable ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Insert">
              {tokens.map((t) => (
                <Button key={t} variant="secondary" size="sm" onClick={() => insertAtCaret(`{{${t}}}`)}>
                  {`{{${t}}}`}
                </Button>
              ))}
              <Button variant="secondary" size="sm" iconStart={<ImagePlus aria-hidden className="size-4" />} onClick={() => file.current?.click()}>
                Insert image
              </Button>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                aria-label="Choose an image to insert"
                onChange={async (e) => {
                  const chosen = e.currentTarget.files?.[0]
                  e.currentTarget.value = ''
                  if (!chosen) return
                  try {
                    const up = await uploadImage(chosen, (note) => toast.push({ title: note, tone: 'warning' }))
                    setPicture({ src: up.src, width: up.width, height: up.height, alt: '' })
                  } catch (error) {
                    toast.push({ title: uploadErrorText(error), tone: 'danger' })
                  }
                }}
              />
            </div>
          ) : null}
          <RHFField control={control} name="bodyMd" label="Body" hint="Markdown. Raw HTML is shown as plain text and is not used on the shop.">
            {(field) => (
              <Textarea
                name={field.name}
                onBlur={field.onBlur}
                ref={(el) => {
                  field.ref(el)
                  area.current = el
                }}
                value={field.value ?? ''}
                onChange={field.onChange}
                invalid={field.invalid}
                rows={16}
                autoGrow
                readOnly={!writable}
                className="font-mono text-sm"
              />
            )}
          </RHFField>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Formatting help</summary>
            <pre className="mt-2 overflow-x-auto rounded-control bg-surface-2 p-3 text-xs">{`## A heading\n\n**bold**, *italic* and [a link](/c/women)\n\n- a list\n- of points\n\n| Size | Bust |\n| --- | --- |\n| M | 36 |\n\n![Alt text](https://… "800x600")`}</pre>
          </details>
        </>
      ) : (
        <div aria-label="Preview of the page" className="min-h-40 rounded-control border border-line p-4">
          {settled.trim() === '' ? <p className="text-sm text-muted">Nothing to preview yet.</p> : preview.isPending ? <Spinner label="Preparing the preview" /> : preview.isError ? <p role="alert" className="text-sm text-danger">The preview could not be made.</p> : <Markdown source={preview.data.bodyMd} imageOrigin={`${env.apiUrl}/img`} />}
        </div>
      )}
      <Dialog
        open={picture !== null}
        onOpenChange={(open) => !open && setPicture(null)}
        title="Insert image"
        description="Describe the picture for people who cannot see it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicture(null)}>
              Cancel
            </Button>
            <Button
              disabled={!picture?.alt.trim()}
              onClick={() => {
                if (!picture) return
                const size = picture.width && picture.height ? ` "${picture.width}x${picture.height}"` : ''
                insertAtCaret(`![${picture.alt.trim()}](${picture.src}${size})`)
                setPicture(null)
              }}
            >
              Insert
            </Button>
          </>
        }
      >
        {picture ? (
          <div className="space-y-3">
            <img src={picture.src} alt="" className="max-h-48 rounded-media" />
            <Field label="Alt text" required>
              <Input value={picture.alt} maxLength={150} onChange={(e) => setPicture({ ...picture, alt: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

/** @param {{ page: Page | null; }} props */
function PageForm({ page }) {
  const isNew = page === null
  const navigate = useNavigate()
  const toast = useToast()
  const can = useCan()
  const queryClient = useQueryClient()
  const { create, update, remove } = usePageMutations()
  const writable = can('content:write')
  const locked = page?.locked ?? false
  const [stale, setStale] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const leaving = useRef(false)
  const form = useForm({
    defaultValues: { title: page?.title ?? '', slug: page?.slug ?? '', bodyMd: page?.bodyMd ?? '', status: page?.status ?? 'draft', seo: { title: page?.seo?.title ?? '', description: page?.seo?.description ?? '' } },
    resolver: contractResolver(PageInput, (/** @type {any} */ v) => body(v)),
  })
  const dirty = Object.keys(form.formState.dirtyFields).length > 0
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)
  const seoTitle = useWatch({ control: form.control, name: 'seo.title' })
  const seoDescription = useWatch({ control: form.control, name: 'seo.description' })
  const title = useWatch({ control: form.control, name: 'title' })
  const slug = useWatch({ control: form.control, name: 'slug' })

  /** @param {any} v */
  const body = (v) => ({ ...prune({ ...v, bodyMd: undefined }), bodyMd: v.bodyMd ?? '' })

  /** @param {number} [version] */
  async function save(version = page?.version) {
    try {
      const doc = body(form.getValues())
      const saved = page ? await update.mutateAsync({ id: page.id, body: /** @type {never} */ ({ ...doc, version }) }) : await create.mutateAsync(/** @type {never} */ (doc))
      form.reset(form.getValues())
      setStale(false)
      toast.push({ title: 'Page saved', tone: 'success' })
      if (isNew) {
        leaving.current = true
        void navigate(`/content/pages/${saved.id}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale_write') setStale(true)
      else if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(() => save())(e)} className="space-y-4 pb-20">
        <PageHeader
          title={isNew ? 'New page' : (page.title || 'Page')}
          actions={
            <>
              {page ? (
                <Button variant="secondary" iconStart={<Eye aria-hidden className="size-4" />} onClick={() => window.open(`${env.storefrontUrl}${page.storefrontUrl}`, '_blank', 'noopener')}>
                  View
                </Button>
              ) : null}
              {page && can('content:delete') && !locked ? (
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
        {locked ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock aria-hidden className="size-4" /> The shop needs this page, so its address is fixed and it cannot be unpublished or deleted.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <SectionCard id="content" title="Content">
            <RHFField control={form.control} name="title" label="Title" required>
              {(field) => (
                <Input
                  {...field}
                  maxLength={100}
                  required
                  readOnly={!writable}
                  onChange={(e) => {
                    const follows = isNew && (form.getValues('slug') === '' || form.getValues('slug') === slugify(form.getValues('title')))
                    field.onChange(e)
                    if (follows) form.setValue('slug', slugify(e.target.value))
                  }}
                />
              )}
            </RHFField>
            <BodyField writable={writable} />
          </SectionCard>
          <aside className="space-y-4" aria-label="Page settings">
            <SectionCard id="status" title="Status">
              <RHFField control={form.control} name="status" label="Status">
                {(field) => (
                  <NativeSelect
                    {...field}
                    disabled={!writable}
                    options={[
                      ...(locked ? [] : [{ value: 'draft', label: 'Draft' }]),
                      { value: 'active', label: 'Active' },
                    ]}
                  />
                )}
              </RHFField>
              <RHFField control={form.control} name="slug" label="Address" required hint={locked ? 'Fixed for required pages.' : page ? 'Changing it keeps the old link working with a redirect.' : 'Lowercase letters, numbers and dashes.'}>
                {(field) => <Input {...field} maxLength={80} required readOnly={!writable || locked} />}
              </RHFField>
            </SectionCard>
            <SectionCard id="seo" title="Search">
              <RHFField control={form.control} name="seo.title" label="Search title" hint="Up to 60 characters.">
                {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} readOnly={!writable} />}
              </RHFField>
              <RHFField control={form.control} name="seo.description" label="Search description" hint="Up to 160 characters.">
                {(field) => <Textarea {...field} value={field.value ?? ''} rows={2} maxLength={160} readOnly={!writable} />}
              </RHFField>
              <div role="group" aria-label="Search result preview" className="rounded-control bg-surface-2 p-3 text-sm">
                <p className="text-accent-text">{seoTitle || title || 'Page title'}</p>
                <p className="text-muted">rubaya.pk/pages/{slug || 'address'}</p>
                <p>{seoDescription || 'The description search engines show under the title.'}</p>
              </div>
            </SectionCard>
          </aside>
        </div>
      </form>

      <StaleWriteDialog
        open={stale}
        what="page"
        onReload={() => {
          if (!page) return
          void queryClient.fetchQuery({ ...pageQueries.detail(page.id), staleTime: 0 }).then((fresh) => {
            form.reset({ title: fresh.title, slug: fresh.slug, bodyMd: fresh.bodyMd, status: fresh.status, seo: { title: fresh.seo?.title ?? '', description: fresh.seo?.description ?? '' } })
            setStale(false)
          })
        }}
        onOverwrite={writable && page ? () => void queryClient.fetchQuery({ ...pageQueries.detail(page.id), staleTime: 0 }).then((fresh) => save(fresh.version)) : undefined}
        saving={update.isPending}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${page?.title ?? ''}?`}
        body="Its address will stop working. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!page) return
          try {
            await remove.mutateAsync(page.id)
            leaving.current = true
            void navigate('/content/pages', { replace: true })
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
        body="Your changes to this page will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}

