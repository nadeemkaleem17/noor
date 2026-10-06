import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { useLocalePath } from '../layout/use-shell'
import { BuyBox } from './buy-box'
import { Gallery } from './gallery'
import { InfoSections } from './sections'

/** A router link for the breadcrumb, which hands over a plain `href`. @type {(props: import('react').ComponentProps<'a'>) => import('react').ReactElement} */
const asRouterLink = ({ href, ...props }) => <RouterLink {...props} to={href ?? '/'} />

/**
 * The product page's frame (plan/06-storefront/04-pdp.md section 2): the way back up, the pictures beside the buy box, the information sections, and under them what streams in later
 * (reviews, related products), given as children.
 * @param {object} props
 * @param {import('~/lib/selection').ProductDetail} props.product
 * @param {import('./size-guide').SizeChart | null} props.sizeChart
 * @param {import('./custom-size').FormSchema | null} props.formSchema
 * @param {string | undefined} props.whatsapp
 * @param {string} props.url
 * @param {string} props.imageOrigin
 * @param {string | undefined} props.cartError
 * @param {number | undefined} props.cartErrorN
 * @param {string | null} props.sizeParam
 * @param {import('react').ReactNode} [props.children]
 */
export function ProductPage({ product, sizeChart, formSchema, whatsapp, url, imageOrigin, cartError, cartErrorN, sizeParam, children }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const [focusValue, setFocusValue] = useState(/** @type {string | undefined} */ (undefined))
  const crumbs = [
    { label: t('listing.home'), href: path('/') },
    ...product.breadcrumb.map((b) => ({ label: b.name, href: path(`/c/${b.handle}`) })),
    { label: product.title },
  ]
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumb items={crumbs} renderLink={asRouterLink} />
      <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery media={product.media} title={product.title} focusValue={focusValue} />
        <div className="flex flex-col gap-6">
          <BuyBox product={product} sizeChart={sizeChart} formSchema={formSchema} whatsapp={whatsapp} url={url} cartError={cartError} cartErrorN={cartErrorN} sizeParam={sizeParam} onFocusValue={setFocusValue} />
          <InfoSections product={product} imageOrigin={imageOrigin} />
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-12">{children}</div>
    </div>
  )
}
