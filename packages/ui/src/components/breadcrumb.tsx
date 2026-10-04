import type { useRender } from '@base-ui/react/use-render'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from './link'

export type Crumb = { label: string; href?: string }

type Props = {
  items: Crumb[]
  /** Router link for client-side navigation, as in `Link`. */
  renderLink?: useRender.RenderProp
  label?: string
  className?: string
}

/** The last item is the current page: `aria-current="page"`, not a link. The separator flips in RTL. */
export function Breadcrumb({ items, renderLink, label, className }: Props) {
  const { t } = useTranslation()
  return (
    <nav aria-label={label ?? t('breadcrumb')} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={`${i}-${item.label}`}>
              <li>
                {last || !item.href ? (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'text-fg' : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} render={renderLink} className="underline-offset-4 hover:text-fg hover:underline">
                    {item.label}
                  </Link>
                )}
              </li>
              {last ? null : (
                <li aria-hidden>
                  <ChevronRight className="size-3.5 rtl:-scale-x-100" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
