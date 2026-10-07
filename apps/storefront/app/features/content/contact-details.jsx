import { useTranslation } from 'react-i18next'
import { Link } from '@noor/ui/link'
import { Ltr } from '@noor/ui/ltr'
import { useShell } from '../layout/use-shell'

const dialable = (/** @type {string} */ phone) => phone.replace(/[^\d+]/g, '')

/**
 * How to reach the shop, written from the store settings and not from the page's text (plan/06-storefront/08-cms-pages.md section 3): changing a number in settings changes it here with no content
 * edit. Whatever is not set is not shown. No contact form: WhatsApp, phone and email are the ways.
 */
export function ContactDetails() {
  const { t } = useTranslation('storefront')
  const c = useShell()?.config.contact
  if (!c) return null
  const rows = [
    c.phone ? { key: 'phone', label: t('contact.phone'), value: <Link href={`tel:${dialable(c.phone)}`}><Ltr>{c.phone}</Ltr></Link> } : undefined,
    c.whatsapp ? { key: 'whatsapp', label: t('contact.whatsapp'), value: <Link href={`https://wa.me/${c.whatsapp}`}>{t('contact.whatsappChat')}</Link> } : undefined,
    c.email ? { key: 'email', label: t('contact.email'), value: <Link href={`mailto:${c.email}`}><Ltr>{c.email}</Ltr></Link> } : undefined,
    c.address ? { key: 'address', label: t('contact.address'), value: <>{c.address}{c.mapUrl ? <> · <Link href={c.mapUrl}>{t('contact.map')}</Link></> : null}</> } : undefined,
    c.hours ? { key: 'hours', label: t('contact.hours'), value: c.hours } : undefined,
  ].flatMap((r) => (r ? [r] : []))
  return (
    <div className="mt-6 flex flex-col gap-6">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className="font-medium">{r.label}</dt>
            <dd className="text-fg-soft [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4">{r.value}</dd>
          </div>
        ))}
      </dl>
      {c.socials.length ? (
        <ul className="flex flex-wrap gap-4" aria-label={t('contact.socials')}>
          {c.socials.map((s) => (
            <li key={s.url}><Link href={s.url} className="text-accent-text underline underline-offset-4">{s.platform}</Link></li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
