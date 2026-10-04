import { useRender } from '@base-ui/react/use-render'
import { isExternal, safeHref } from '../safe-href'

/**
 * @typedef {Omit<import('react').ComponentProps<'a'>, 'href'> & { href: string; render?: useRender.RenderProp; }} LinkProps
 */

/**
 * A plain link whose href is checked with `safeHref`. Pass the app's router link as `render` for client-side navigation.
 * @param {LinkProps} props
 */
export function Link({ href, render, ref, ...props }) {
  const safe = safeHref(href)
  return useRender({
    defaultTagName: 'a',
    render,
    ref,
    enabled: safe !== undefined,
    props: { href: safe, rel: safe && isExternal(safe) ? 'noopener noreferrer' : undefined, ...props },
  })
}
