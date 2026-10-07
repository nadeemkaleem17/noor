import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, useNavigation } from 'react-router'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Image, imageProps } from '@noor/ui/image'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { useHydrated } from '../catalog/filters'
import { useLocalePath } from '../layout/use-shell'

const MAX_PHOTOS = 3

/** Up to three pictures: each is sent to the storefront as soon as it is chosen and comes back as an id, which travels with the review. Needs JavaScript; a review is as good without. @param {{ token: string, lineId: string }} props */
function Photos({ token, lineId }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const input = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [photos, setPhotos] = useState(/** @type {{ id: string, url: string }[]} */ ([]))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const choose = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // the shop's server refuses more than this anyway; the visitor is told at once and nothing is sent
    if (file.size > 5 * 1024 * 1024) {
      setProblem(t('review.photoErrors.size'))
      return
    }
    setBusy(true)
    setProblem('')
    try {
      const res = await fetch(path(`/orders/${token}/review/${lineId}/photo`), { method: 'POST', headers: { 'content-type': file.type }, body: file })
      const body = await res.json()
      if (res.ok && typeof body.mediaId === 'string') setPhotos((p) => [...p, { id: body.mediaId, url: URL.createObjectURL(file) }])
      else setProblem(t(`review.photoErrors.${body.error ?? 'failed'}`))
    } catch {
      setProblem(t('review.photoErrors.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t('review.photos')}</legend>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            <img src={p.url} alt="" className="size-20 rounded-control object-cover" />
            <input type="hidden" name="photo" value={p.id} />
            <button type="button" aria-label={t('review.removePhoto')} onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))} className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-fg text-bg">×</button>
          </li>
        ))}
      </ul>
      {photos.length < MAX_PHOTOS ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} className="sr-only" tabIndex={-1} aria-hidden="true" />
          <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>{t('review.addPhoto')}</Button>
        </>
      ) : null}
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
    </fieldset>
  )
}

/**
 * The review of one order line (plan/06-storefront/06-orders-tracking.md section 6): a rating, how it fit, a title, the words, a name and up to three pictures. It waits for a
 * moderator before it shows. A form like any other: it works without JavaScript, except for the pictures.
 * @param {{ invite: import('@noor/contract').ReviewInvite, token: string, lineId: string, result: any, values: Record<string, string> }} props
 */
export function ReviewForm({ invite, token, lineId, result, values }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const navigation = useNavigation()
  const fields = result?.error === 'fields' ? /** @type {Record<string, string>} */ (result.fields) : {}
  const fail = (/** @type {string} */ name) => (fields[name] ? t(`review.fieldErrors.${name}`, { defaultValue: t('review.fieldErrors.invalid') }) : undefined)
  const rating = values.rating ?? ''
  return (
    <Form method="post" noValidate={hydrated} className="mt-6 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{t('review.rating')}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="relative">
              <input type="radio" name="rating" value={n} defaultChecked={rating === String(n)} required className="peer sr-only" />
              <span className="grid size-11 place-items-center rounded-control border border-line-strong text-xl peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:outline-2" aria-hidden="true">{n}★</span>
              <span className="sr-only">{t('pdp.stars', { n })}</span>
            </label>
          ))}
        </div>
        {fail('rating') ? <p role="alert" className="text-sm text-danger">{fail('rating')}</p> : null}
      </fieldset>
      {invite.sized ? (
        <Field label={t('review.fit')}>
          <NativeSelect name="fit" placeholder={t('review.fitSkip')} defaultValue={values.fit ?? ''} options={['runs_small', 'true_to_size', 'runs_large'].map((v) => ({ value: v, label: t(`pdp.fit.${v}`) }))} />
        </Field>
      ) : null}
      <Field label={t('review.titleLabel')}>
        <Input name="title" maxLength={100} defaultValue={values.title ?? ''} />
      </Field>
      <Field label={t('review.body')} required hint={t('review.bodyHint')} {...(fail('body') ? { error: fail('body') } : {})}>
        <Textarea name="body" required minLength={20} maxLength={1000} rows={5} defaultValue={values.body ?? ''} invalid={Boolean(fail('body'))} />
      </Field>
      <Field label={t('review.name')} required {...(fail('displayName') ? { error: fail('displayName') } : {})}>
        <Input name="displayName" required minLength={2} maxLength={40} defaultValue={values.displayName ?? invite.displayNameDefault} invalid={Boolean(fail('displayName'))} />
      </Field>
      {hydrated ? <Photos token={token} lineId={lineId} /> : null}
      {result && result.error && result.error !== 'fields' ? <p role="alert" className="text-sm text-danger">{t(`review.errors.${result.error}`)}</p> : null}
      <Button type="submit" size="lg" loading={navigation.state !== 'idle'}>{t('review.submit')}</Button>
    </Form>
  )
}

/** The picture of the product being reviewed. @param {{ image?: import('@noor/contract').Image | undefined, title: string }} props */
export function Reviewed({ image, title }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      {image ? <Image {...imageProps(image)} alt="" sizes="64px" ratio="3 / 4" className="w-14 rounded-control bg-surface-2" /> : null}
      <p className="font-medium">{title}</p>
    </div>
  )
}
