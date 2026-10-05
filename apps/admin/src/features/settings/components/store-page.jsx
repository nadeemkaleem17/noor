import { CheckoutSettings, StoreSettings } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { PhoneInput } from '@noor/ui/phone-input'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useWatch } from 'react-hook-form'
import { FormFieldsEditor, fieldsFromApi, fieldsToApi } from '@/components/form-fields-editor'
import { PageHeader } from '@/components/page-header'
import { PictureField } from '@/components/picture-field'
import { checkoutQuery, storeQuery, translationQuery, useSaveCheckout, useSaveStoreSlice } from '../api'
import { SettingsCard } from './settings-card'

/** @param {import('react-hook-form').ControllerRenderProps<any, any>} field */
const text = (field) => ({ ...field, value: field.value ?? '' })

const socials = ['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest'].map((v) => ({ value: v, label: v.replace(/^./, (c) => c.toUpperCase()) }))

/** Leaves out empty strings so "not filled in" is never sent as a value. @param {Record<string, any>} o */
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null))

/** @param {{ doc: any; }} props */
function BrandCard({ doc }) {
  const save = useSaveStoreSlice()
  const v = doc.value
  const [images, setImages] = useState(/** @type {Record<string, string>} */ (Object.fromEntries(Object.entries(doc.images ?? {}).map(([id, img]) => [id, /** @type {{ src: string; }} */ (img).src]))))
  return (
    <SettingsCard
      id="brand"
      title="Brand"
      defaults={{ brand: { name: v.brand.name, tagline: v.brand.tagline ?? '', logoLightMediaId: v.brand.logoLightMediaId ?? '', logoDarkMediaId: v.brand.logoDarkMediaId ?? '', faviconMediaId: v.brand.faviconMediaId ?? '' } }}
      schema={StoreSettings.pick({ brand: true })}
      toValue={(f) => ({ brand: compact(f.brand) })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <>
          <RHFField control={form.control} name="brand.name" label="Store name" required>
            {(field) => <Input {...field} maxLength={60} required readOnly={!writable} />}
          </RHFField>
          <RHFField control={form.control} name="brand.tagline" label="Tagline">
            {(field) => <Input {...text(field)} maxLength={120} readOnly={!writable} />}
          </RHFField>
          {/** @type {const} */ ([
            ['brand.logoLightMediaId', 'Logo for light backgrounds', { minSide: 100, goodSide: 400 }],
            ['brand.logoDarkMediaId', 'Logo for dark backgrounds (optional)', { minSide: 100, goodSide: 400 }],
            ['brand.faviconMediaId', 'Favicon (square, at least 180 pixels)', { minSide: 180, goodSide: 180 }],
          ]).map(([key, label, limits]) => (
            <Controller
              key={key}
              control={form.control}
              name={key}
              render={({ field }) => (
                <Field label={label}>
                  <PictureField
                    mediaId={field.value || undefined}
                    src={field.value ? images[field.value] : undefined}
                    label={`Drop the picture for ${label.toLowerCase()} here or choose a file`}
                    disabled={!writable}
                    limits={limits}
                    onPick={(img) => {
                      if (img) setImages((m) => ({ ...m, [img.id]: img.src }))
                      field.onChange(img?.id ?? '')
                    }}
                  />
                </Field>
              )}
            />
          ))}
        </>
      )}
    </SettingsCard>
  )
}

/** @param {{ doc: any; }} props */
function ContactCard({ doc }) {
  const save = useSaveStoreSlice()
  const c = doc.value.contact
  return (
    <SettingsCard
      id="contact"
      title="Contact"
      defaults={{ contact: { whatsapp: c.whatsapp ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', mapUrl: c.mapUrl ?? '', hours: c.hours ?? '', socials: c.socials ?? [] } }}
      schema={StoreSettings.pick({ contact: true })}
      toValue={(f) => ({ contact: { ...compact({ ...f.contact, whatsapp: String(f.contact.whatsapp ?? '').replace(/^\+/, '') }), socials: (f.contact.socials ?? []).filter((/** @type {{ url: string; }} */ s) => s.url) } })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => <ContactFields form={form} writable={writable} />}
    </SettingsCard>
  )
}

/** @param {{ form: import('react-hook-form').UseFormReturn<any>; writable: boolean; }} props */
function ContactFields({ form, writable }) {
  const rows = useFieldArray({ control: form.control, name: 'contact.socials', keyName: 'rid' })
  return (
    <>
      <RHFField control={form.control} name="contact.whatsapp" label="WhatsApp number" hint="Every WhatsApp link in the shop uses it.">
        {(field) => (
          <PhoneInput
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            invalid={field.invalid}
            readOnly={!writable}
            value={field.value ? `+${String(field.value).replace(/^\+/, '')}` : ''}
            onValueChange={(v) => field.onChange(v.replace(/^\+/, ''))}
          />
        )}
      </RHFField>
      <div className="grid gap-3 sm:grid-cols-2">
        <RHFField control={form.control} name="contact.phone" label="Phone">
          {(field) => <Input {...text(field)} maxLength={30} readOnly={!writable} />}
        </RHFField>
        <RHFField control={form.control} name="contact.email" label="Email">
          {(field) => <Input {...text(field)} type="email" maxLength={254} readOnly={!writable} />}
        </RHFField>
      </div>
      <RHFField control={form.control} name="contact.address" label="Address">
        {(field) => <Textarea {...text(field)} rows={2} maxLength={300} readOnly={!writable} />}
      </RHFField>
      <div className="grid gap-3 sm:grid-cols-2">
        <RHFField control={form.control} name="contact.mapUrl" label="Map link" hint="Starts with https://">
          {(field) => <Input {...text(field)} inputMode="url" maxLength={500} readOnly={!writable} />}
        </RHFField>
        <RHFField control={form.control} name="contact.hours" label="Opening hours">
          {(field) => <Input {...text(field)} maxLength={120} readOnly={!writable} />}
        </RHFField>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Social links</legend>
        {rows.fields.map((f, i) => (
          <div key={f.rid} className="flex items-end gap-2">
            <RHFField control={form.control} name={`contact.socials.${i}.platform`} label="Platform">
              {(field) => <NativeSelect {...field} options={socials} disabled={!writable} />}
            </RHFField>
            <RHFField control={form.control} name={`contact.socials.${i}.url`} label="Address" className="flex-1">
              {(field) => <Input {...text(field)} inputMode="url" readOnly={!writable} placeholder="https://" />}
            </RHFField>
            {writable ? <IconButton label={`Remove social link ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => rows.remove(i)} /> : null}
          </div>
        ))}
        {writable && rows.fields.length < 8 ? (
          <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => rows.append({ platform: 'instagram', url: '' })}>
            Add a social link
          </Button>
        ) : null}
      </fieldset>
    </>
  )
}

/** @param {{ doc: any; }} props */
function PricesCard({ doc }) {
  const save = useSaveStoreSlice()
  const v = doc.value
  return (
    <SettingsCard
      id="prices"
      title="Prices"
      description="How prices are shown. What customers are charged is always exact."
      defaults={{ priceDisplay: { showDecimals: v.priceDisplay.showDecimals, rounding: v.priceDisplay.rounding }, orderNumberPrefix: v.orderNumberPrefix }}
      schema={StoreSettings.pick({ priceDisplay: true, orderNumberPrefix: true })}
      toValue={(f) => ({ priceDisplay: { showDecimals: Boolean(f.priceDisplay.showDecimals), rounding: f.priceDisplay.rounding }, orderNumberPrefix: f.orderNumberPrefix })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <>
          <Controller control={form.control} name="priceDisplay.showDecimals" render={({ field }) => <Checkbox label="Show paisa (Rs. 6,990.00 instead of Rs. 6,990)" disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          <RHFField control={form.control} name="priceDisplay.rounding" label="Display rounding" hint="Presentation only.">
            {(field) => (
              <NativeSelect
                {...field}
                disabled={!writable}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'nearest', label: 'To the nearest rupee' },
                  { value: 'up', label: 'Up to the next rupee' },
                ]}
              />
            )}
          </RHFField>
          <RHFField control={form.control} name="orderNumberPrefix" label="Order number prefix" hint="2 to 4 capital letters. Only new orders use a changed prefix.">
            {(field) => <Input {...field} maxLength={4} readOnly={!writable} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />}
          </RHFField>
        </>
      )}
    </SettingsCard>
  )
}

/** @param {{ form: import('react-hook-form').UseFormReturn<any>; writable: boolean; }} props */
function LanguageFields({ form, writable }) {
  const supported = /** @type {string[]} */ (useWatch({ control: form.control, name: 'locale.supported' }) ?? ['en'])
  const status = useQuery({ ...translationQuery, enabled: supported.includes('ur') })
  return (
    <>
      <Controller
        control={form.control}
        name="locale.supported"
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Languages</legend>
            <Checkbox label="English (always on)" checked disabled />
            <Checkbox
              label="Urdu"
              disabled={!writable}
              checked={supported.includes('ur')}
              onCheckedChange={(on) => {
                field.onChange(on ? ['en', 'ur'] : ['en'])
                if (!on && form.getValues('locale.default') === 'ur') form.setValue('locale.default', 'en', { shouldDirty: true })
              }}
            />
          </fieldset>
        )}
      />
      {supported.includes('ur') && status.data ? (
        <p className="text-sm text-muted">
          Urdu so far: {Math.round((status.data.ui.translated / Math.max(1, status.data.ui.total)) * 100)}% of the shop's text and {Math.round((status.data.products.translated / Math.max(1, status.data.products.total)) * 100)}% of active products.
        </p>
      ) : null}
      <RHFField control={form.control} name="locale.default" label="Default language">
        {(field) => (
          <NativeSelect
            {...field}
            disabled={!writable}
            options={[
              { value: 'en', label: 'English' },
              ...(supported.includes('ur') ? [{ value: 'ur', label: 'Urdu' }] : []),
            ]}
          />
        )}
      </RHFField>
    </>
  )
}

/** @param {{ doc: any; }} props */
function LanguagesCard({ doc }) {
  const save = useSaveStoreSlice()
  const l = doc.value.locale
  return (
    <SettingsCard
      id="languages"
      title="Languages"
      defaults={{ locale: { supported: l.supported, default: l.default } }}
      schema={StoreSettings.pick({ locale: true })}
      toValue={(f) => ({ locale: { default: f.locale.default, supported: f.locale.supported } })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => <LanguageFields form={form} writable={writable} />}
    </SettingsCard>
  )
}

const featureList = /** @type {const} */ ([
  ['wishlist', 'Wishlist', 'Customers can save products to a list.'],
  ['reviews', 'Reviews', 'Customers can rate and review products, and the Reviews screen appears here.'],
  ['notifyMe', 'Back-in-stock alerts', 'Customers can ask to be told when a sold-out size returns.'],
  ['customSizing', 'Custom sizing', 'Made-to-order products can ask for measurements.'],
])

/** @param {{ doc: any; }} props */
function FeaturesCard({ doc }) {
  const save = useSaveStoreSlice()
  return (
    <SettingsCard id="features" title="Features" defaults={{ features: { ...doc.value.features } }} schema={StoreSettings.pick({ features: true })} toValue={(f) => ({ features: { ...f.features } })} save={(slice) => save.mutateAsync(slice)}>
      {(form, writable) => (
        <div className="space-y-3">
          {featureList.map(([key, label, effect]) => (
            <Controller key={key} control={form.control} name={`features.${key}`} render={({ field }) => (
              <div>
                <Switch label={label} disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                <p className="ms-14 text-sm text-muted">{effect}</p>
              </div>
            )} />
          ))}
        </div>
      )}
    </SettingsCard>
  )
}

/** The extra checkout fields and the marketing consent box: their own document. @param {{ doc: any; }} props */
function CheckoutCard({ doc }) {
  const save = useSaveCheckout()
  const v = doc.value
  return (
    <SettingsCard
      id="checkout"
      title="Checkout"
      description="Name, phone, city and address are always asked. You can add up to 3 more fields."
      defaults={{ extraFields: fieldsFromApi(v.extraFields), marketingConsent: { enabled: v.marketingConsent.enabled, label: v.marketingConsent.label } }}
      schema={CheckoutSettings}
      toValue={(f) => ({ extraFields: fieldsToApi(f.extraFields ?? []).map(dropEmpty), marketingConsent: { enabled: Boolean(f.marketingConsent.enabled), label: f.marketingConsent.label ?? '' } })}
      save={(value) => save.mutateAsync(value)}
    >
      {(form, writable) => (
        <>
          {writable || form.getValues('extraFields').length ? <FormFieldsEditor control={/** @type {any} */ (form.control)} name="extraFields" max={3} legend="Extra fields" addLabel="Add a checkout field" /> : null}
          <Controller control={form.control} name="marketingConsent.enabled" render={({ field }) => <Switch label="Ask for marketing consent" disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          <RHFField control={form.control} name="marketingConsent.label" label="Consent text">
            {(field) => <Input {...text(field)} maxLength={160} readOnly={!writable} />}
          </RHFField>
        </>
      )}
    </SettingsCard>
  )
}

/** A field without its unset keys. @param {Record<string, any>} f */
const dropEmpty = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null))

/** @param {{ doc: any; }} props */
function PoliciesCard({ doc }) {
  const save = useSaveStoreSlice()
  const p = doc.value.policies
  return (
    <SettingsCard
      id="policies"
      title="Policies"
      description="Short versions. The full text is in the pages."
      defaults={{ policies: { returnsDays: p.returnsDays ?? null, returns: p.returns ?? '', shipping: p.shipping ?? '', privacy: p.privacy ?? '', terms: p.terms ?? '' } }}
      schema={StoreSettings.pick({ policies: true })}
      toValue={(f) => ({ policies: compact({ ...f.policies, returnsDays: f.policies.returnsDays ?? undefined }) })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <>
          <RHFField control={form.control} name="policies.returnsDays" label="Returns window (days)" hint="Fills {{returns.days}} in the pages.">
            {(field) => <NumberInput name={field.name} ref={field.ref} min={0} max={90} readOnly={!writable} value={field.value ?? null} onValueChange={(n) => field.onChange(n)} />}
          </RHFField>
          {/** @type {const} */ ([['returns', 'Returns, in one line'], ['shipping', 'Shipping, in one line'], ['privacy', 'Privacy, in one line'], ['terms', 'Terms, in one line']]).map(([key, label]) => (
            <RHFField key={key} control={form.control} name={`policies.${key}`} label={label}>
              {(field) => <Input {...text(field)} maxLength={300} readOnly={!writable} />}
            </RHFField>
          ))}
        </>
      )}
    </SettingsCard>
  )
}

/** @param {{ doc: any; }} props */
function SeoCard({ doc }) {
  const save = useSaveStoreSlice()
  return (
    <SettingsCard
      id="seo"
      title="Search"
      defaults={{ seo: { homeDescription: doc.value.seo.homeDescription ?? '' } }}
      schema={StoreSettings.pick({ seo: true })}
      toValue={(f) => ({ seo: compact(f.seo) })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <RHFField control={form.control} name="seo.homeDescription" label="Home page description" hint="Up to 160 characters. What search engines show under the shop's name.">
          {(field) => <Textarea {...text(field)} rows={2} maxLength={160} readOnly={!writable} />}
        </RHFField>
      )}
    </SettingsCard>
  )
}

/** @param {{ doc: any; }} props */
function NotificationsCard({ doc }) {
  const save = useSaveStoreSlice()
  return (
    <SettingsCard
      id="notifications"
      title="Notifications"
      errorPath={(path) => path.replace(/\.\d+$/, '')}
      defaults={{ notifications: { staffEmails: (doc.value.notifications.staffEmails ?? []).join(', ') } }}
      schema={StoreSettings.pick({ notifications: true })}
      toValue={(f) => ({ notifications: { staffEmails: String(f.notifications.staffEmails ?? '').split(/[,\s]+/).filter(Boolean) } })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <RHFField control={form.control} name="notifications.staffEmails" label="Order notification emails" hint="Separate several with commas. Sent once an email service is connected.">
          {(field) => <Input {...text(field)} inputMode="email" readOnly={!writable} />}
        </RHFField>
      )}
    </SettingsCard>
  )
}

/** `/settings/store` (plan/07-admin/11-settings.md section 2). */
export function StorePage() {
  const store = useQuery(storeQuery)
  const checkout = useQuery(checkoutQuery)
  if (store.isPending || checkout.isPending) return <Spinner label="Loading the settings" />
  if (store.isError || checkout.isError) return <ErrorState title="The settings could not be loaded" retryLabel="Try again" onRetry={() => (void store.refetch(), void checkout.refetch())} />
  return (
    <>
      <PageHeader title="Store" description="The shop's name, contact details and rules. Each card saves on its own." />
      <div className="space-y-4">
        <BrandCard doc={store.data} />
        <ContactCard doc={store.data} />
        <PricesCard doc={store.data} />
        <LanguagesCard doc={store.data} />
        <FeaturesCard doc={store.data} />
        <CheckoutCard doc={checkout.data} />
        <PoliciesCard doc={store.data} />
        <SeoCard doc={store.data} />
        <NotificationsCard doc={store.data} />
      </div>
    </>
  )
}
