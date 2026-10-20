import { X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@noor/ui/link'
import { safeHref } from '@noor/ui/safe-href'
import { cookieIn, readCookies, subscribeCookies, writeCookie } from '~/lib/browser-cookie'
import { paletteClass } from './notice-palette'
import { useLocalePath } from './use-shell'

/** @typedef {{ id: string, text: string, href?: string | undefined, palette?: string | undefined }} Notice */

const COOKIE = 'nc_dismissed'
const ROTATE_MS = 6_000

/** The ids the visitor has closed, kept in a session cookie. Read in the browser only (the server answers "none"): the page itself is the same for everyone and is cached. @param {string} cookies */
const idsIn = (cookies) => (cookieIn(cookies, COOKIE) ?? '').split(',').filter(Boolean)

/**
 * The shop's announcement and its current notices (plan/06-storefront/01-sitemap.md section 3): one at a time, changing every six seconds unless the visitor rests on it
 * or has asked for less movement, and each can be closed for the rest of the visit.
 * @param {{ items: Notice[] }} props
 */
export function Announcement({ items }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const cookies = useSyncExternalStore(subscribeCookies, readCookies, () => '')
  const closed = idsIn(cookies)
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)

  const shown = items.filter((n) => !closed.includes(n.id))
  useEffect(() => {
    if (paused || shown.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setAt((i) => i + 1), ROTATE_MS)
    return () => clearInterval(timer)
  }, [paused, shown.length])

  const current = shown.length ? shown[at % shown.length] : undefined
  if (!current) return null
  const href = current.href ? safeHref(current.href) : undefined

  /** @param {string} id */
  const dismiss = (id) => {
    writeCookie(COOKIE, [...closed, id].join(','))
  }

  return (
    <div
      className={paletteClass[current.palette ?? 'accent'] ?? paletteClass.accent}
      role="region"
      aria-label={t('shell.announcementLabel', { defaultValue: 'Announcement' })}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <p className="flex-1 text-center">
          {href ? (
            <Link href={href.startsWith('/') ? path(href) : href} className="underline underline-offset-4">
              {current.text}
            </Link>
          ) : (
            current.text
          )}
        </p>
        <button type="button" onClick={() => dismiss(current.id)} aria-label={t('shell.announcementDismiss')} className="grid size-8 place-items-center rounded-control hover:bg-black/10">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  )
}
