import { ApiError, ProductInput } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Menu } from '@noor/ui/menu'
import { Spinner } from '@noor/ui/spinner'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Ellipsis, Eye, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useBlocker, useNavigate } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { contractResolver } from '@/lib/form'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { productQueries, useProductMutations } from '../api'
import { toBody, toForm } from '../form-values'
import { BasicsSection } from './basics-section'
import { ChecksCard } from './checks-card'
import { DetailsSection } from './details-section'
import { OrganisationCard } from './organisation-card'
import { SeoSection } from './seo-section'
import { StatusCard } from './status-card'

const sections = [
  ['basics', 'Basics'],
  ['details', 'Details'],
  ['seo', 'Search and address'],
]

/**
 * `/products/new` (no id) and `/products/:id`: loads the product, then hands it to the form.
 * @param {{ id?: string; }} props
 */
export function ProductEditor({ id }) {
  const product = useQuery({ ...productQueries.detail(id ?? ''), enabled: Boolean(id) })
  if (id && product.isPending) return <Spinner label="Loading the product" />
  if (id && product.isError) {
    const missing = product.error instanceof ApiError && product.error.status === 404
    return <ErrorState title={missing ? 'Product not found' : 'The product could not be loaded'} retryLabel={missing ? undefined : 'Try again'} onRetry={missing ? undefined : () => void product.refetch()} />
  }
  return <ProductForm key={product.data?.id ?? 'new'} product={product.data ?? null} />
}

/** @param {{ product: import('../api').AdminProduct | null; }} props */
function ProductForm({ product }) {
  const isNew = product === null
  const navigate = useNavigate()
  const toast = useToast()
  const can = useCan()
  const queryClient = useQueryClient()
  const { create, update, duplicate, remove, previewLink } = useProductMutations()
  const form = useForm({ defaultValues: toForm(product), resolver: contractResolver(ProductInput, toBody) })
  // not `formState.isDirty`: it compares whole objects and stays true after a reset when a field registered an undefined key
  const dirty = Object.keys(form.formState.dirtyFields).length > 0
  const [stale, setStale] = useState(/** @type {{ currentVersion: number; } | null} */ (null))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const leaving = useRef(false) // set once a save has moved the person on, so the unsaved-changes guard stays out of the way
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)

  // the browser's own prompt for a reload or a closed tab
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (/** @type {BeforeUnloadEvent} */ e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** @param {number} [version] the version to save over; the stored one by default */
  async function save(version = product?.version) {
    const body = /** @type {never} */ ({ ...toBody(form.getValues()), ...(version ? { version } : {}) })
    try {
      const saved = product ? await update.mutateAsync({ id: product.id, body }) : await create.mutateAsync(body)
      form.reset(toForm(saved))
      setStale(null)
      toast.push({ title: 'Product saved', tone: 'success' })
      if (isNew) {
        leaving.current = true
        void navigate(`/products/${saved.id}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale_write') setStale({ currentVersion: Number(error.details.currentVersion) })
      else if (error instanceof ApiError && error.issues.length > 0) {
        for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code }, { shouldFocus: true })
        toast.push({ title: 'Some fields need attention', tone: 'warning' })
      } else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  async function reloadTheirs() {
    if (!product) return
    const fresh = await queryClient.fetchQuery({ ...productQueries.detail(product.id), staleTime: 0 })
    form.reset(toForm(fresh))
    setStale(null)
  }

  const saving = create.isPending || update.isPending
  const published = product?.status === 'active'
  const items = product
    ? [
        { label: 'Duplicate', icon: <Copy aria-hidden className="size-4" />, onSelect: () => duplicate.mutate(product.id, { onSuccess: (copy) => void navigate(`/products/${copy.id}`), onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) }) },
        ...(can('products:delete') ? [{ label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => setConfirmDelete(true) }] : []),
      ]
    : []

  return (
    <FormProvider {...form}>
      <form id="product-form" noValidate onSubmit={(event) => void form.handleSubmit(() => save())(event)} className="pb-20">
        <PageHeader
          title={isNew ? 'New product' : (product.title || 'Product')}
          description={isNew ? 'Choose the type and category first; the rest follows.' : undefined}
          actions={
            <>
              {product ? (
                <Button
                  variant="secondary"
                  iconStart={<Eye aria-hidden className="size-4" />}
                  loading={previewLink.isPending}
                  onClick={() =>
                    published && product.storefrontUrl
                      ? window.open(product.storefrontUrl, '_blank', 'noopener')
                      : previewLink.mutate(product.id, { onSuccess: (r) => window.open(r.url, '_blank', 'noopener'), onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) })
                  }
                >
                  View
                </Button>
              ) : null}
              {items.length ? <Menu align="end" trigger={<Button variant="secondary" aria-label="More actions" iconStart={<Ellipsis aria-hidden className="size-4" />} />} items={items} /> : null}
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </>
          }
        />
        <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-3 text-sm">
          {sections.map(([anchor, label]) => (
            <a key={anchor} href={`#${anchor}`} className="text-accent-text underline underline-offset-2">
              {label}
            </a>
          ))}
        </nav>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <BasicsSection suggestHandle={isNew} />
            <DetailsSection />
            <SeoSection published={published} />
          </div>
          <aside className="space-y-4" aria-label="Product settings">
            <StatusCard />
            <OrganisationCard />
            <ChecksCard />
          </aside>
        </div>

        {dirty ? (
          <div role="region" aria-label="Unsaved changes" className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-3 border-t border-line bg-surface px-4 py-3 shadow-pop">
            <p className="me-auto text-sm">You have unsaved changes.</p>
            <Button variant="secondary" onClick={() => form.reset()}>
              Discard
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        ) : null}
      </form>

      <Dialog
        open={stale !== null}
        onOpenChange={(open) => !open && setStale(null)}
        title="Someone else changed this product"
        description="It was saved by someone else while you were editing. Choose which version to keep."
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => void reloadTheirs()}>
              Reload their version
            </Button>
            {can('products:publish') ? (
              <Button variant="danger" loading={saving} onClick={() => void save(stale?.currentVersion)}>
                Overwrite with mine
              </Button>
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${product?.title ?? 'this product'}?`}
        body="This cannot be undone. A product that has been ordered cannot be deleted: archive it instead."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!product) return
          try {
            await remove.mutateAsync(product.id)
            leaving.current = true
            void navigate('/products', { replace: true })
          } catch (error) {
            toast.push({ title: error instanceof ApiError && error.code === 'in_use' ? 'This product has orders, so it cannot be deleted. Archive it instead.' : messageFor(error), tone: 'danger' })
            throw error
          }
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        body="Your changes to this product will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}
