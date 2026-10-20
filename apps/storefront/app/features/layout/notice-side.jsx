import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { cookieIn, readCookies, subscribeCookies, writeCookie } from '~/lib/browser-cookie'
import { paletteClass } from './notice-palette'
import { SafeLinkButton } from './safe-link'
import { useLocalePath } from './use-shell'

const COOKIE = 'nc_dismissed'

/** @typedef {{ id: string, text: string, title?: string | undefined, body?: string | undefined, href?: string | undefined, buttonText?: string | undefined, palette?: string | undefined }} SideNotice */

/**
 * Side notices: a small card at the corner of the page for the rest of the visit, until it is closed (the same list of closed ones the notice bar keeps). On a phone it sits along the
 * bottom edge. It does not take the focus, so reading and shopping go on.
 * @param {{ items: SideNotice[] }} props
 */
export function NoticeSide({ items }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const cookies = useSyncExternalStore(subscribeCookies, readCookies, () => '')
  const closed = (cookieIn(cookies, COOKIE) ?? '').split(',').filter(Boolean)
  const shown = items.filter((n) => !closed.includes(n.id))
  if (!shown.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30 flex flex-col items-end gap-3 sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-80">
      {shown.slice(0, 2).map((n) => {
        const href = n.href?.startsWith('/') ? path(n.href) : n.href
        return (
          <aside key={n.id} aria-label={n.title || n.text} className={`pointer-events-auto w-full rounded-card p-4 shadow-card ${paletteClass[n.palette ?? 'accent'] ?? paletteClass.accent}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-heading text-lg">{n.title || n.text}</p>
                {n.body || n.title ? <p className="text-sm">{n.body || n.text}</p> : null}
                {href && n.buttonText ? (
                  <div className="pt-2">
                    <SafeLinkButton href={href} variant="secondary">{n.buttonText}</SafeLinkButton>
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => writeCookie(COOKIE, [...closed, n.id].join(','))} aria-label={t('shell.announcementDismiss')} className="grid size-8 shrink-0 place-items-center rounded-control hover:bg-black/10">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </aside>
        )
      })}
    </div>
  )
}
