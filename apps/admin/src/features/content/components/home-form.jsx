import { ApiError, fullHomeOrder, HomeContent } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { ErrorState } from '@noor/ui/error-state'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form'
import { useBlocker } from 'react-router'
import { LinkInput } from '@/components/link-input'
import { PictureField } from '@/components/picture-field'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { StaleWriteDialog } from '@/components/stale-write-dialog'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { env } from '@/lib/env'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { contentKeys, homeQuery, useSaveHome } from '../api'

const newId = () => `i${Math.random().toString(36).slice(2, 10)}`
const GOOD_WIDTH = 1600

/** A text field that reads `''` for nothing. @param {import('react-hook-form').ControllerRenderProps<any, any>} field */
const text = (field) => ({ ...field, value: field.value ?? '' })

/**
 * A picture of the home page. Pictures narrower than the page wants are accepted with a warning.
 * @param {{ mediaId: string | undefined; src: string | undefined; onPick: (img: { id: string; src: string; } | null) => void; label: string; disabled: boolean; }} props
 */
function Picture({ mediaId, src, onPick, label, disabled }) {
  const toast = useToast()
  return (
    <PictureField
      mediaId={mediaId}
      src={src}
      onPick={onPick}
      label={label}
      disabled={disabled}
      limits={{ goodSide: GOOD_WIDTH }}
      onWarn={(note) => toast.push({ title: note.replace('long side', 'wide'), tone: 'warning' })}
    />
  )
}

/** The two crops a hero picture is shown in: 4:5 on phones, 16:7 on large screens. @param {{ src: string; }} props */
function CropPreview({ src }) {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="How the picture is cropped">
      <figure>
        <img src={src} alt="" className="h-28 rounded-media object-cover" style={{ aspectRatio: '4 / 5' }} />
        <figcaption className="text-xs text-muted">Phone, 4:5</figcaption>
      </figure>
      <figure>
        <img src={src} alt="" className="h-28 rounded-media object-cover" style={{ aspectRatio: '16 / 7' }} />
        <figcaption className="text-xs text-muted">Large screen, 16:7</figcaption>
      </figure>
    </div>
  )
}

/** @param {{ writable: boolean; }} props */
function AnnouncementCard({ writable }) {
  const { control } = useFormContext()
  return (
    <SectionCard id="announcement" title="Announcement bar" description="The strip above the header. Empty text hides it.">
      <RHFField control={control} name="announcement.text" label="Text">
        {(field) => <Input {...text(field)} maxLength={100} readOnly={!writable} />}
      </RHFField>
      <RHFField control={control} name="announcement.href" label="Link">
        {(field) => <LinkInput {...text(field)} readOnly={!writable} />}
      </RHFField>
    </SectionCard>
  )
}

/** @param {{ writable: boolean; }} props */
function NoticesCard({ writable }) {
  const { control } = useFormContext()
  const rows = useFieldArray({ control, name: 'notices', keyName: 'rid' })
  return (
    <SectionCard id="notices" title="Notices" description="Short messages shown in turn while their dates allow. Up to 5.">
      {rows.fields.map((f, i) => (
        <fieldset key={f.rid} className="space-y-2 rounded-card border border-line p-3">
          <legend className="px-1 text-sm font-medium">{`Notice ${i + 1}`}</legend>
          <RHFField control={control} name={`notices.${i}.text`} label="Text" required>
            {(field) => <Input {...text(field)} maxLength={140} readOnly={!writable} />}
          </RHFField>
          <div className="grid gap-2 sm:grid-cols-2">
            <RHFField control={control} name={`notices.${i}.href`} label="Link">
              {(field) => <LinkInput {...text(field)} readOnly={!writable} />}
            </RHFField>
            <RHFField control={control} name={`notices.${i}.severity`} label="Kind">
              {(field) => (
                <NativeSelect
                  {...field}
                  disabled={!writable}
                  options={[
                    { value: 'info', label: 'Information' },
                    { value: 'promo', label: 'Promotion' },
                    { value: 'notice', label: 'Notice' },
                  ]}
                />
              )}
            </RHFField>
            <RHFField control={control} name={`notices.${i}.startsAt`} label="Starts" hint="Optional. Pakistan time.">
              {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} readOnly={!writable} value={toLocalInput(field.value)} onChange={(e) => field.onChange(fromLocalInput(e.target.value))} />}
            </RHFField>
            <RHFField control={control} name={`notices.${i}.endsAt`} label="Ends" hint="Optional.">
              {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} readOnly={!writable} value={toLocalInput(field.value)} onChange={(e) => field.onChange(fromLocalInput(e.target.value))} />}
            </RHFField>
          </div>
          {writable ? (
            <Button variant="ghost" size="sm" iconStart={<Trash2 aria-hidden className="size-4" />} onClick={() => rows.remove(i)}>
              Remove notice {i + 1}
            </Button>
          ) : null}
        </fieldset>
      ))}
      {writable && rows.fields.length < 5 ? (
        <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => rows.append({ id: newId(), text: '', severity: 'info' })}>
          Add a notice
        </Button>
      ) : null}
    </SectionCard>
  )
}

/** @param {{ writable: boolean; images: Record<string, string>; onPicture: (id: string, src: string) => void; }} props */
function HeroCard({ writable, images, onPicture }) {
  const { control, setValue } = useFormContext()
  const rows = useFieldArray({ control, name: 'heroSlides', keyName: 'rid' })
  const slides = /** @type {{ mediaId?: string; }[]} */ (useWatch({ control, name: 'heroSlides' }) ?? [])
  return (
    <SectionCard id="hero" title="Hero slides" description="The big pictures at the top of the home page. Up to 6. Keep faces and products in the middle: on phones the picture is cropped to 4:5.">
      {rows.fields.map((f, i) => {
        const mediaId = slides[i]?.mediaId
        const src = mediaId ? images[mediaId] : undefined
        return (
          <fieldset key={f.rid} className="space-y-2 rounded-card border border-line p-3">
            <legend className="px-1 text-sm font-medium">{`Slide ${i + 1}`}</legend>
            <Picture
              mediaId={mediaId}
              src={src}
              label={`Drop the picture for slide ${i + 1} here or choose a file`}
              disabled={!writable}
              onPick={(img) => {
                if (img) onPicture(img.id, img.src)
                setValue(`heroSlides.${i}.mediaId`, img?.id ?? '', { shouldDirty: true, shouldValidate: true })
              }}
            />
            {src ? <CropPreview src={src} /> : null}
            <RHFField control={control} name={`heroSlides.${i}.alt`} label="Picture description (alt text)" required>
              {(field) => <Input {...text(field)} maxLength={150} readOnly={!writable} />}
            </RHFField>
            <div className="grid gap-2 sm:grid-cols-2">
              <RHFField control={control} name={`heroSlides.${i}.heading`} label="Heading" required>
                {(field) => <Input {...text(field)} maxLength={60} readOnly={!writable} />}
              </RHFField>
              <RHFField control={control} name={`heroSlides.${i}.subheading`} label="Subheading">
                {(field) => <Input {...text(field)} maxLength={90} readOnly={!writable} />}
              </RHFField>
              <RHFField control={control} name={`heroSlides.${i}.buttonText`} label="Button text" hint="A button needs both its text and its link.">
                {(field) => <Input {...text(field)} maxLength={24} readOnly={!writable} />}
              </RHFField>
              <RHFField control={control} name={`heroSlides.${i}.buttonHref`} label="Button link">
                {(field) => <LinkInput {...text(field)} readOnly={!writable} />}
              </RHFField>
            </div>
            {writable ? (
              <div className="flex gap-1">
                <IconButton label={`Move slide ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => rows.move(i, i - 1)} />
                <IconButton label={`Move slide ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === rows.fields.length - 1} onClick={() => rows.move(i, i + 1)} />
                <IconButton label={`Remove slide ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => rows.remove(i)} />
              </div>
            ) : null}
          </fieldset>
        )
      })}
      {writable && rows.fields.length < 6 ? (
        <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => rows.append({ id: newId(), mediaId: '', alt: '', heading: '' })}>
          Add a slide
        </Button>
      ) : null}
    </SectionCard>
  )
}

/**
 * What each section of the home page is, and what staff can set on it (the shop reads these in routes/home.jsx).
 * @type {Record<(typeof import('@noor/contract').homeSectionKeys)[number], { title: string; note: string; heading?: boolean; count?: [number, number]; countLabel?: string; band?: boolean }>}
 */
const sectionInfo = {
  categories: { title: 'Category pictures', note: 'A row of round pictures of the main categories.', heading: true, count: [2, 12], countLabel: 'How many categories' },
  newIn: { title: 'New in', note: 'The newest products, with a tab for each category.', heading: true, count: [4, 12], countLabel: 'How many products' },
  collections: { title: 'Collections', note: 'Featured collections, each a picture and a name.', heading: true, count: [1, 6], countLabel: 'How many collections' },
  categoryBlocks: { title: 'Category blocks', note: 'The best sellers of each main category, one block per category.', count: [1, 6], countLabel: 'How many categories' },
  promo: { title: 'Promo band', note: 'Switched on and written in the Promo band card below.', band: true },
  bestsellers: { title: 'Bestsellers', note: 'The products that sell most, with a tab for each category.', heading: true, count: [4, 12], countLabel: 'How many products' },
  editorial: { title: 'Editorial band', note: 'Switched on and written in the Editorial band card below.', band: true },
}

/** The order, switches and sizes of the parts of the home page below the pictures (plan/17-owner-requests-2026-10.md items 2 and 3). @param {{ writable: boolean }} props */
function LayoutCard({ writable }) {
  const { control, setValue } = useFormContext()
  const order = /** @type {(keyof typeof sectionInfo)[]} */ (useWatch({ control, name: 'layout.order' }))
  /** @param {number} i @param {number} by */
  const move = (i, by) => {
    const next = [...order]
    const [item] = next.splice(i, 1)
    if (item) next.splice(i + by, 0, item)
    setValue('layout.order', next, { shouldDirty: true })
  }
  return (
    <SectionCard id="layout" title="Home page sections" description="The parts below the pictures, from top to bottom. Move them, switch them off, and say how many to show. The shop looks the same until you change something here.">
      <ol className="space-y-3">
        {order.map((key, i) => {
          const info = sectionInfo[key]
          return (
            <li key={key} className="rounded-card border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-sm font-medium" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="me-auto font-medium">{info.title}</h3>
                {writable ? (
                  <>
                    <IconButton label={`Move ${info.title} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton label={`Move ${info.title} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === order.length - 1} onClick={() => move(i, 1)} />
                  </>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">{info.note}</p>
              {info.band ? null : (
                <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_8rem] sm:items-end">
                  <Controller control={control} name={`layout.${key}.enabled`} render={({ field }) => <Switch label={`Show ${info.title}`} disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
                  {info.heading ? (
                    <RHFField control={control} name={`layout.${key}.heading`} label="Heading" hint="Empty: the usual words">
                      {(field) => <Input {...text(field)} maxLength={60} readOnly={!writable} />}
                    </RHFField>
                  ) : (
                    <span />
                  )}
                  {info.count ? (
                    <RHFField control={control} name={`layout.${key}.count`} label={info.countLabel ?? 'How many'}>
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          inputMode="numeric"
                          min={info.count?.[0]}
                          max={info.count?.[1]}
                          value={field.value ?? ''}
                          readOnly={!writable}
                        />
                      )}
                    </RHFField>
                  ) : null}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

/**
 * The promo and editorial bands share one shape; the editorial band also has a picture.
 * @param {{ name: 'promo' | 'editorial'; title: string; writable: boolean; picture?: { images: Record<string, string>; onPicture: (id: string, src: string) => void; }; }} props
 */
function BandCard({ name, title, writable, picture }) {
  const { control, setValue } = useFormContext()
  const mediaId = /** @type {string | undefined} */ (useWatch({ control, name: `${name}.mediaId` }))
  const src = mediaId && picture ? picture.images[mediaId] : undefined
  return (
    <SectionCard id={name} title={title} description="Hidden in the shop when switched off or when the heading is empty.">
      <Controller control={control} name={`${name}.enabled`} render={({ field }) => <Switch label="Show this band" disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
      {picture ? (
        <>
          <Picture
            mediaId={mediaId}
            src={src}
            label="Drop the band's picture here or choose a file"
            disabled={!writable}
            onPick={(img) => {
              if (img) picture.onPicture(img.id, img.src)
              setValue(`${name}.mediaId`, img?.id ?? '', { shouldDirty: true })
            }}
          />
          <RHFField control={control} name={`${name}.alt`} label="Picture description (alt text)">
            {(field) => <Input {...text(field)} maxLength={150} readOnly={!writable} />}
          </RHFField>
        </>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <RHFField control={control} name={`${name}.eyebrow`} label="Small heading above">
          {(field) => <Input {...text(field)} maxLength={30} readOnly={!writable} />}
        </RHFField>
        <RHFField control={control} name={`${name}.heading`} label="Heading">
          {(field) => <Input {...text(field)} maxLength={60} readOnly={!writable} />}
        </RHFField>
      </div>
      <RHFField control={control} name={`${name}.text`} label="Text">
        {(field) => <Textarea {...text(field)} rows={2} maxLength={name === 'promo' ? 200 : 300} readOnly={!writable} />}
      </RHFField>
      <div className="grid gap-2 sm:grid-cols-2">
        <RHFField control={control} name={`${name}.buttonText`} label="Button text">
          {(field) => <Input {...text(field)} maxLength={24} readOnly={!writable} />}
        </RHFField>
        <RHFField control={control} name={`${name}.buttonHref`} label="Button link">
          {(field) => <LinkInput {...text(field)} readOnly={!writable} />}
        </RHFField>
      </div>
    </SectionCard>
  )
}

/** @param {import('@noor/contract').HomeContent} v */
const defaults = (v) => ({
  announcement: { text: v.announcement.text, href: v.announcement.href ?? '' },
  notices: v.notices,
  heroSlides: v.heroSlides,
  promo: v.promo,
  editorial: v.editorial,
  footer: v.footer,
  layout: { ...v.layout, order: fullHomeOrder(v.layout?.order ?? []) },
})

/** What the API takes: empty optional fields left out, the two required texts kept even when empty. @param {any} v */
function body(v) {
  // the sizes are typed as text (so a number can be cleared and typed again) and are numbers on the wire
  const sized = v.layout ? { ...v, layout: Object.fromEntries(Object.entries(v.layout).map(([k, sec]) => [k, sec && typeof sec === 'object' && 'count' in sec ? { ...sec, count: sec.count === '' || sec.count === undefined ? undefined : Number(sec.count) } : sec])) } : v
  const clean = /** @type {any} */ (prune(sized))
  return { ...clean, announcement: { text: v.announcement?.text ?? '', ...(v.announcement?.href ? { href: v.announcement.href } : {}) }, footer: { about: v.footer?.about ?? '' } }
}

/** `/content/home` (plan/07-admin/09-content.md section 2): one form, one Save, the document saved whole with its version. */
export function HomeForm() {
  const home = useQuery(homeQuery)
  if (home.isPending) return <Spinner label="Loading the home page content" />
  if (home.isError) return <ErrorState title="The home page content could not be loaded" retryLabel="Try again" onRetry={() => void home.refetch()} />
  return <Form key={home.data.version} doc={home.data} />
}

/** @param {{ doc: any; }} props */
function Form({ doc }) {
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const save = useSaveHome()
  const writable = can('content:write')
  const [images, setImages] = useState(/** @type {Record<string, string>} */ (Object.fromEntries(Object.entries(doc.images).map(([id, img]) => [id, /** @type {{ src: string; }} */ (img).src]))))
  const [stale, setStale] = useState(false)
  const leaving = useRef(false)
  const form = useForm({
    defaultValues: defaults(/** @type {import('@noor/contract').HomeContent} */ (doc.value)),
    resolver: contractResolver(HomeContent, (/** @type {any} */ v) => body(v)),
  })
  const dirty = Object.keys(form.formState.dirtyFields).length > 0
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)
  /** @param {string} id @param {string} src */
  const remember = (id, src) => setImages((m) => ({ ...m, [id]: src }))

  /** @param {number} [version] */
  async function submit(version = doc.version) {
    try {
      await save.mutateAsync(/** @type {never} */ ({ value: body(form.getValues()), version }))
      setStale(false)
      toast.push({ title: 'Home page saved', tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale_write') setStale(true)
      else if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(() => submit())(e)} className="space-y-4 pb-20">
        <PageHeader
          title="Home page"
          description="What the shop's front page says. Contact details come from the store settings."
          actions={
            <>
              <Button variant="secondary" onClick={() => window.open(env.storefrontUrl, '_blank', 'noopener')}>
                Preview storefront
              </Button>
              {writable ? (
                <Button type="submit" loading={save.isPending}>
                  Save
                </Button>
              ) : null}
            </>
          }
        />
        <AnnouncementCard writable={writable} />
        <NoticesCard writable={writable} />
        <HeroCard writable={writable} images={images} onPicture={remember} />
        <LayoutCard writable={writable} />
        <BandCard name="promo" title="Promo band" writable={writable} />
        <BandCard name="editorial" title="Editorial band" writable={writable} picture={{ images, onPicture: remember }} />
        <SectionCard id="footer" title="Footer" description="Phone, email, address and social links come from the store settings.">
          <RHFField control={form.control} name="footer.about" label="About text">
            {(field) => <Textarea {...text(field)} rows={3} maxLength={300} readOnly={!writable} />}
          </RHFField>
        </SectionCard>
      </form>
      <StaleWriteDialog
        open={stale}
        what="page"
        onReload={() => {
          leaving.current = true
          void queryClient.invalidateQueries({ queryKey: contentKeys.home })
          setStale(false)
        }}
        onOverwrite={writable ? () => void queryClient.fetchQuery({ ...homeQuery, staleTime: 0 }).then((fresh) => submit(fresh.version)) : undefined}
        saving={save.isPending}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        body="Your changes to the home page will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}
