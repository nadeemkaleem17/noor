import { useRender } from '@base-ui/react/use-render'
import type { ComponentProps } from 'react'
import { isExternal, safeHref } from '../safe-href'

export type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string; render?: useRender.RenderProp }

/** A plain link whose href is checked with `safeHref`. Pass the app's router link as `render` for client-side navigation. */
export function Link({ href, render, ref, ...props }: LinkProps) {
  const safe = safeHref(href)
  return useRender({
    defaultTagName: 'a',
    render,
    ref,
    enabled: safe !== undefined,
    props: { href: safe, rel: safe && isExternal(safe) ? 'noopener noreferrer' : undefined, ...props },
  })
}
