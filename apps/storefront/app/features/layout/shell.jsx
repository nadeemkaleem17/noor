import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, Outlet, useLocation } from 'react-router'
import { ToastProvider } from '@noor/ui/toast'
import { CartDrawerProvider } from '../cart/cart-drawer'
import { Announcement } from './announcement'
import { NoticePopup } from './notice-popup'
import { NoticeSide } from './notice-side'
import { CheckoutHeader } from './checkout-header'
import { ConsentNotice, CookieChoices } from './consent'
import { Footer } from './footer'
import { Header } from './header'
import { NavProgress } from './nav-progress'
import { useShell } from './use-shell'

/** The same page in the other language: `/ur` goes in front or comes off (plan/03 section 8). @param {string} pathname @param {string} search @param {'en' | 'ur'} to */
export function switchLocalePath(pathname, search, to) {
  const bare = pathname.replace(/^\/ur(?=\/|$)/, '') || '/'
  return (to === 'en' ? bare : `/ur${bare === '/' ? '' : bare}`) + search
}

/** A round button at the end corner that opens WhatsApp with a short greeting; not on the checkout, and not at all without a number. @param {{ number: string }} props */
function WhatsAppButton({ number }) {
  const { t } = useTranslation('storefront')
  const { pathname } = useLocation()
  if (/^(\/ur)?\/checkout(\/|$)/.test(pathname)) return null
  // a product page has the buy bar along the foot of a phone's screen: the button rides above it
  const onProduct = /^(\/ur)?\/p\//.test(pathname)
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(t('shell.waGeneric', { defaultValue: 'Hi, I have a question.' }))}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('shell.whatsapp')}
      className={`fixed end-4 z-20 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg ${onProduct ? 'bottom-24 lg:bottom-4' : 'bottom-4'}`}
    >
      <MessageCircle aria-hidden="true" className="size-7" />
    </a>
  )
}

/** A link to the other language, only when the shop has more than one. @param {{ supported: readonly string[], locale: 'en' | 'ur' }} props */
function LanguageSwitch({ supported, locale }) {
  const { t } = useTranslation('storefront')
  const { pathname, search } = useLocation()
  const other = supported.find((l) => l !== locale)
  if (!other) return null
  return (
    <RouterLink to={switchLocalePath(pathname, search, /** @type {'en' | 'ur'} */ (other))} lang={other} reloadDocument className="underline underline-offset-4" aria-label={t('shell.language')}>
      {t('language.switch')}
    </RouterLink>
  )
}

/**
 * The frame of every page: skip link, announcement, header, the page, footer (plan/06-storefront/01-sitemap.md section 3).
 * Nothing here belongs to one visitor: the cart count is fetched by the browser after the page has loaded (M5-05).
 */
export default function Shell() {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const { pathname } = useLocation()
  if (!shell) return <Outlet />
  // the checkout has a header of its own and no footer: nothing to wander off to
  const checkout = /^(\/ur)?\/checkout\/?$/.test(pathname)
  const { config, nav, notices, about, locale, headerBar } = shell
  // visits are counted, and the shop asks first: the question is drawn, and the footer can reopen it
  const asksFirst = config.features.visitTracking && config.features.visitConsent !== false
  return (
    <ToastProvider>
      <CartDrawerProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        {t('shell.skip')}
      </a>
      <NavProgress />
      {shell.preview ? <p role="status" className="bg-fg px-4 py-2 text-center text-small text-surface">{t('shell.preview')}</p> : null}
      {checkout ? null : <Announcement items={notices.filter((n) => n.position === 'bar')} />}
      {checkout ? null : <NoticePopup items={notices.filter((n) => n.position === 'popup')} />}
      {checkout ? null : <NoticeSide items={notices.filter((n) => n.position === 'side')} />}
      {checkout ? <CheckoutHeader brand={config.brand.name} logo={config.brand.logoLight} /> : <Header brand={config.brand.name} logo={config.brand.logoLight} items={nav.header} wishlist={config.features.wishlist} bar={headerBar} />}
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      {checkout ? null : <Footer brand={config.brand.name} about={about} columns={nav.footer} contact={config.contact} payments={config.payments} cookieChoices={<CookieChoices active={asksFirst} />} languageSwitch={<LanguageSwitch supported={config.locale.supported} locale={locale} />} />}
      {config.contact.whatsapp ? <WhatsAppButton number={config.contact.whatsapp} /> : null}
      {checkout ? null : <ConsentNotice active={asksFirst} />}
      </CartDrawerProvider>
    </ToastProvider>
  )
}
