import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@noor/ui/button'
import { cookieIn, readCookies, subscribeCookies, writeCookie } from '~/lib/browser-cookie'
import { CONSENT_COOKIE, consentOf } from '~/lib/consent'
import { forgetVisit, reportVisitNow } from '~/lib/visit.client'

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * What this visitor said about counting visits: `yes`, `no`, `unset`, or `server` while the page is still the server's (it knows nothing of a visitor, so nothing is drawn until the browser
 * has read its own cookie).
 */
function useConsent() {
  const cookies = useSyncExternalStore(subscribeCookies, readCookies, () => undefined)
  if (cookies === undefined) return 'server'
  return consentOf(cookieIn(cookies, CONSENT_COOKIE))
}

/** @param {boolean} on @returns {Promise<void>} */
async function choose(on) {
  writeCookie(CONSENT_COOKIE, on ? '1' : '0', { maxAge: ONE_YEAR })
  // the shop's server enforces the answer too: it counts nothing without a yes, and a no clears the visitor number it may have set
  if (on) reportVisitNow()
  else forgetVisit()
}

/**
 * The question about counting visits (plan/17-owner-requests-2026-10.md section 6): asked once, answered by a button, remembered for a year. Nothing is counted before a yes. Drawn only
 * while the shop counts visits and asks first (Store settings, Features).
 * @param {{ active: boolean }} props
 */
export function ConsentNotice({ active }) {
  const { t } = useTranslation('storefront')
  const consent = useConsent()
  if (!active || consent !== 'unset') return null
  return (
    <section aria-label={t('consent.label')} className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-surface p-4 text-fg shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-small">{t('consent.text')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void choose(false)}>{t('consent.decline')}</Button>
          <Button onClick={() => void choose(true)}>{t('consent.accept')}</Button>
        </div>
      </div>
    </section>
  )
}

/** A way to change the answer later: the footer's "Cookie choices" asks the question again. @param {{ active: boolean }} props */
export function CookieChoices({ active }) {
  const { t } = useTranslation('storefront')
  const consent = useConsent()
  if (!active || (consent !== 'yes' && consent !== 'no')) return null
  return (
    <button type="button" className="underline underline-offset-4" onClick={() => writeCookie(CONSENT_COOKIE, '', { maxAge: 0 })}>
      {t('consent.change')}
    </button>
  )
}
