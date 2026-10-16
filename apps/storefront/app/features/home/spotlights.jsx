import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { LinkButton } from '@noor/ui/button'
import { Image, imageProps } from '@noor/ui/image'
import { useLocalePath } from '../layout/use-shell'

/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */

/**
 * One block for each top category (DOC-06.13 section 5): its picture, its name, "Shop <name>" and four of its best sellers, the picture on the left and then on the right.
 * Together with the round pictures under the hero, every category of the shop is on the home page twice. A category with no picture or fewer than two pieces is left out here
 * (it still has its round entry when it has a picture).
 * @param {{ blocks: { category: { id: string, handle: string, name: string, image?: import('@noor/contract').Image | undefined }, items: ProductSummary[] }[] }} props
 */
export function CategorySpotlights({ blocks }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const shown = blocks.filter((b) => b.category.image && b.items.length >= 2)
  if (!shown.length) return null
  return (
    <section className="defer-render mx-auto flex max-w-7xl flex-col gap-12 px-4 py-8" aria-label={t('home.spotlights')}>
      {shown.map(({ category: c, items }, i) => (
        <div key={c.id} className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
          <RouterLink to={path(`/c/${c.handle}`)} className={`block ${i % 2 ? 'md:order-2' : ''}`} tabIndex={-1} aria-hidden="true">
            {c.image ? <Image {...imageProps(c.image)} alt="" sizes="(min-width:768px) 50vw, 100vw" ratio="4 / 3" className="w-full rounded-media" /> : null}
          </RouterLink>
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-3xl">{c.name}</h2>
            <ul className="grid grid-cols-4 gap-3">
              {items.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <RouterLink to={path(`/p/${p.handle}`)} className="block">
                    <Image {...imageProps(p.primaryImage)} alt={p.title} sizes="(min-width:768px) 12vw, 22vw" ratio="3 / 4" className="w-full rounded-media" />
                  </RouterLink>
                </li>
              ))}
            </ul>
            <LinkButton href={path(`/c/${c.handle}`)} variant="secondary" className="self-start" render={<RouterLink to={path(`/c/${c.handle}`)} />}>
              {t('home.shopCategory', { name: c.name })}
            </LinkButton>
          </div>
        </div>
      ))}
    </section>
  )
}
