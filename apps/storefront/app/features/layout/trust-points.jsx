import { Banknote, MessageCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { useLocalePath, useShell } from './use-shell'

/** Three promises with what is behind each, and a link to the page that says it in full (DOC-06.14 PD-10); a promise the shop does not make is not drawn. `row` lays them side by side (the footer); otherwise they are a list (the product page). @param {{ whatsappHref: string | undefined, row?: boolean }} props */
export function TrustPoints({ whatsappHref, row: sideBySide = false }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const config = useShell()?.config
  const cod = config?.payments.some((p) => p.type === 'cod')
  const days = config?.policies.returnsDays
  const line = 'flex min-h-6 items-center gap-3 text-small text-fg-soft hover:text-fg'
  const items = [
    cod ? { id: 'cod', icon: Banknote, text: t('home.trustCod'), href: path('/pages/shipping-returns') } : undefined,
    days ? { id: 'returns', icon: RotateCcw, text: t('home.trustReturns', { days }), href: path('/pages/shipping-returns') } : undefined,
    whatsappHref ? { id: 'wa', icon: MessageCircle, text: t('home.trustWhatsapp'), href: whatsappHref } : undefined,
  ].filter((x) => x !== undefined)
  if (!items.length) return null
  return (
    <ul aria-label={t('pdp.trustLabel')} className={sideBySide ? 'flex flex-wrap gap-x-8 gap-y-3' : 'flex flex-col gap-2 border-y border-line py-3'}>
      {items.map(({ id, icon: Icon, text, href }) => (
        <li key={id}>
          {href.startsWith('/') ? (
            <RouterLink to={href} className={line}>
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {text}
            </RouterLink>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className={line}>
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {text}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
