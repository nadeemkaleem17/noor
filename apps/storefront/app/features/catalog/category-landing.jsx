import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Image, imageProps } from '@noor/ui/image'
import { useLocalePath } from '../layout/use-shell'
import { ProductGrid } from './product-card'

/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */

/** One rail of products with its heading and a link to everything. @param {{ id: string, title: string, items: ProductSummary[], href: string, more: string }} props */
function Rail({ id, title, items, href, more }) {
  if (!items.length) return null
  return (
    <section aria-labelledby={id} className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-heading text-2xl">{title}</h2>
        <RouterLink to={href} className="text-small underline underline-offset-4">{more}</RouterLink>
      </div>
      <ProductGrid items={items} eager={0} />
    </section>
  )
}

/**
 * What a category that has sub-categories shows above its products (DOC-06.13 section 6): its picture, a tile for each sub-category with its picture and how many pieces it holds,
 * two short rails (new in, bestsellers), and the heading of the full listing under them.
 * @param {{ category: import('@noor/contract').z.infer<typeof import('@noor/contract').CategoryDetail>, rails: { newest: ProductSummary[], best: ProductSummary[] } | undefined }} props
 */
export function CategoryLanding({ category, rails }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const href = path(`/c/${category.handle}`)
  return (
    <>
      {category.image ? <Image {...imageProps(category.image)} alt="" sizes="(min-width:1280px) 1216px, 100vw" ratio="16 / 6" className="mt-4 w-full rounded-media" /> : null}
      <ul aria-label={t('listing.shopBy')} className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {category.children.map((c) => (
          <li key={c.handle}>
            <RouterLink to={path(`/c/${c.handle}`)} prefetch="intent" className="group block">
              {c.image ? <Image {...imageProps(c.image)} alt="" sizes="(min-width:768px) 25vw, 50vw" ratio="3 / 4" className="w-full rounded-media" /> : <span className="block aspect-3/4 rounded-media bg-surface-2" />}
              <span className="mt-2 block text-ui font-medium group-hover:underline">{c.name}</span>
              <span className="text-small text-muted">{t('listing.tileCount', { count: c.productCount })}</span>
            </RouterLink>
          </li>
        ))}
      </ul>
      {rails ? (
        <>
          <Rail id="rail-new" title={t('listing.railNew', { name: category.name })} items={rails.newest} href={`${href}?sort=newest`} more={t('listing.railMore', { name: category.name })} />
          <Rail id="rail-best" title={t('listing.railBest', { name: category.name })} items={rails.best} href={`${href}?sort=bestselling`} more={t('listing.railMore', { name: category.name })} />
        </>
      ) : null}
      <h2 className="mt-12 font-heading text-2xl">{t('listing.allIn', { name: category.name })}</h2>
    </>
  )
}
