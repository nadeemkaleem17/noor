import { Link as RouterLink } from 'react-router'
import { LinkButton } from '@noor/ui/button'
import { safeHref } from '@noor/ui/safe-href'
import { useLocalePath } from './use-shell'

/**
 * A button that is a link, for an address staff typed (a hero button, a promo, a notice). An address inside the shop stays in the visitor's language and goes through the router;
 * one with an unsafe scheme (`javascript:`) draws nothing at all (plan/04-design-system/components.md section 4.1).
 * @param {Omit<import('@noor/ui/button').LinkButtonProps, 'href' | 'render'> & { href: string | undefined }} props
 */
export function SafeLinkButton({ href, ...props }) {
  const path = useLocalePath()
  const safe = href ? safeHref(href) : undefined
  if (!safe) return null
  const to = safe.startsWith('/') ? path(safe) : undefined
  return <LinkButton {...props} href={to ?? safe} render={to ? <RouterLink to={to} /> : undefined} />
}
