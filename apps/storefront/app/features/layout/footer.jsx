import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Link } from '@noor/ui/link'
import { safeHref } from '@noor/ui/safe-href'
import { Ltr } from '@noor/ui/ltr'

/** A line of text is about 20 px tall: WCAG 2.2 (2.5.8) wants a target of 24 px, so these links are padded to it. */
const tapLine = 'inline-block py-0.5'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

const dialable = (/** @type {string} */ phone) => phone.replace(/[^\d+]/g, '')

/**
 * The foot of every page (plan/06-storefront/01-sitemap.md section 3): about the shop, the footer menu, how to reach it, the ways to pay, and the year.
 * @param {{ brand: string, about?: string | undefined, columns: { shop: NavItem[], collections: NavItem[], help: NavItem[], company: NavItem[] }, contact: import('@noor/contract').StoreConfigPublic['contact'], payments: { type: string, label: string }[], languageSwitch?: import('react').ReactNode }} props
 */
export function Footer({ brand, about, columns, contact, payments, languageSwitch }) {
  const { t } = useTranslation('storefront')
  const whatsapp = contact.whatsapp ? `https://wa.me/${contact.whatsapp}` : undefined
  const socials = contact.socials.flatMap((s) => (safeHref(s.url) ? [s] : []))
  return (
    <footer className="mt-16 border-t border-line bg-surface text-fg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <p className="font-heading text-xl font-semibold">{brand}</p>
          {about ? <p className="mt-2 text-fg-soft">{about}</p> : null}
        </div>
        <Column title={t('shell.footerShop')} items={columns.shop} />
        <Column title={t('shell.footerCollections')} items={columns.collections} />
        <Column title={t('shell.footerHelp')} items={columns.help} />
        <Column title={t('shell.footerCompany')} items={columns.company} />
        <div>
          <h2 className="font-medium">{t('shell.footerContact')}</h2>
          <ul className="mt-2 flex flex-col gap-1 text-fg-soft">
            {contact.phone ? (
              <li>
                <Link href={`tel:${dialable(contact.phone)}`} className={tapLine}>
                  <Ltr>{contact.phone}</Ltr>
                </Link>
              </li>
            ) : null}
            {contact.email ? (
              <li>
                <Link href={`mailto:${contact.email}`} className={tapLine}>{contact.email}</Link>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <Link href={whatsapp} className={tapLine}>WhatsApp</Link>
              </li>
            ) : null}
            {contact.address ? <li>{contact.address}</li> : null}
            {socials.map((s) => (
              <li key={s.url}>
                <Link href={s.url} className={tapLine}>{s.platform}</Link>
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

/** One column of footer links; nothing at all when it has none. @param {{ title: string, items: NavItem[] }} props */
function Column({ title, items }) {
  if (!items.length) return null
  return (
    <nav aria-label={title}>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            {item.href.startsWith('/') ? (
              <RouterLink to={item.href} className={`${tapLine} text-fg-soft hover:text-fg`}>
                {item.label}
              </RouterLink>
            ) : (
              <Link href={item.href} className={`${tapLine} text-fg-soft hover:text-fg`}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
