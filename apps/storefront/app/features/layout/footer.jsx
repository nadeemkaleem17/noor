import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Link } from '@noor/ui/link'
import { safeHref } from '@noor/ui/safe-href'
import { Ltr } from '@noor/ui/ltr'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

const dialable = (/** @type {string} */ phone) => phone.replace(/[^\d+]/g, '')

/**
 * The foot of every page (plan/06-storefront/01-sitemap.md section 3): about the shop, the footer menu, how to reach it, the ways to pay, and the year.
 * @param {{ brand: string, about?: string | undefined, items: NavItem[], contact: import('@noor/contract').StoreConfigPublic['contact'], payments: { type: string, label: string }[], languageSwitch?: import('react').ReactNode }} props
 */
export function Footer({ brand, about, items, contact, payments, languageSwitch }) {
  const { t } = useTranslation('storefront')
  const whatsapp = contact.whatsapp ? `https://wa.me/${contact.whatsapp}` : undefined
  const socials = contact.socials.flatMap((s) => (safeHref(s.url) ? [s] : []))
  return (
    <footer className="mt-16 border-t border-line bg-surface text-fg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-heading text-xl font-semibold">{brand}</p>
          {about ? <p className="mt-2 text-fg-soft">{about}</p> : null}
        </div>
        {items.length ? (
          <nav aria-label={t('shell.footerNavLabel')}>
            <h2 className="font-medium">{t('shell.footerShop')}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id}>
                  {item.href.startsWith('/') ? (
                    <RouterLink to={item.href} className="text-fg-soft hover:text-fg">
                      {item.label}
                    </RouterLink>
                  ) : (
                    <Link href={item.href} className="text-fg-soft hover:text-fg">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div>
          <h2 className="font-medium">{t('shell.footerContact')}</h2>
          <ul className="mt-2 flex flex-col gap-1 text-fg-soft">
            {contact.phone ? (
              <li>
                <Link href={`tel:${dialable(contact.phone)}`}>
                  <Ltr>{contact.phone}</Ltr>
                </Link>
              </li>
            ) : null}
            {contact.email ? (
              <li>
                <Link href={`mailto:${contact.email}`}>{contact.email}</Link>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <Link href={whatsapp}>WhatsApp</Link>
              </li>
            ) : null}
            {contact.address ? <li>{contact.address}</li> : null}
            {socials.map((s) => (
              <li key={s.url}>
                <Link href={s.url}>{s.platform}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-fg-soft">
          <p>{t('shell.rights', { year: new Date().getFullYear(), brand })}</p>
          {languageSwitch}
          {payments.length ? (
            <p>
              {t('shell.footerPayments')}: {payments.map((p) => p.label).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
