import { Dialog } from '@noor/ui/dialog'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { popupDue } from './notice-palette'
import { SafeLinkButton } from './safe-link'
import { useLocalePath } from './use-shell'

/** @typedef {{ id: string, text: string, title?: string | undefined, body?: string | undefined, href?: string | undefined, buttonText?: string | undefined, popupEvery: 'visit' | 'day' | 'once' }} Popup */

const KEY = 'nc_popups'

/** When each popup was last shown in this browser; storage that is blocked reads as "never". */
function remembered() {
  try {
    return /** @type {Record<string, number>} */ (JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return {}
  }
}

/**
 * The popup notice: one, a moment after the shop opens, and again only as often as staff chose (every visit, once a day, once ever). It is a real dialog: it takes the focus, Escape
 * closes it, and the page behind waits. Nothing is drawn on the server, so a page without scripts is not covered.
 * @param {{ items: Popup[] }} props
 */
export function NoticePopup({ items }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const [current, setCurrent] = useState(/** @type {Popup | null} */ (null))

  useEffect(() => {
    if (!items.length) return
    const timer = setTimeout(() => {
      const last = remembered()
      const now = Date.now()
      const due = items.find((n) => {
        let seen = false
        try {
          seen = sessionStorage.getItem(`${KEY}:${n.id}`) === '1'
        } catch {
          // storage is blocked: it counts as not seen
        }
        return popupDue(n.popupEvery, last[n.id], seen, now)
      })
      if (!due) return
      try {
        sessionStorage.setItem(`${KEY}:${due.id}`, '1')
        localStorage.setItem(KEY, JSON.stringify({ ...last, [due.id]: now }))
      } catch {
        // storage is blocked: it may show again, which is better than never
      }
      setCurrent(due)
    }, 1500)
    return () => clearTimeout(timer)
  }, [items])

  if (!current) return null
  const href = current.href?.startsWith('/') ? path(current.href) : current.href
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && setCurrent(null)}
      title={current.title || current.text}
      description={current.body || (current.title ? current.text : undefined)}
      closeLabel={t('shell.announcementDismiss')}
      size="sm"
      footer={href && current.buttonText ? <SafeLinkButton href={href}>{current.buttonText}</SafeLinkButton> : undefined}
    />
  )
}
