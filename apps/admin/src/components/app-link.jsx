import { Link } from '@noor/ui/link'
import { Link as RouterLink } from 'react-router'

/**
 * A link inside the app: client-side navigation, with the href still checked by `safeHref`.
 * @param {Omit<import('react').ComponentProps<'a'>, 'href'> & { to: string; }} props
 */
export function AppLink({ to, className = 'text-accent-text underline underline-offset-2 hover:no-underline', ...props }) {
  return <Link href={to} render={<RouterLink to={to} />} className={className} {...props} />
}
