// The product form holds the contract's `ProductInput`; these functions move between it and what the API sends and returns.
import { prune } from '@/lib/form'

/** A new product: a draft with nothing chosen yet. @returns {import('@noor/contract').ProductInput} */
export const emptyProduct = () => ({
  handle: '',
  status: 'draft',
  kind: 'stitched',
  title: '',
  primaryCategoryId: '',
  categoryIds: [],
  attributes: [],
  media: [],
  options: [],
  variants: [],
  badges: [],
})

/** Fields the server adds to what it stores; the form never sends them back. */
const readOnly = ['id', 'version', 'createdAt', 'updatedAt', 'publishedAt', 'siblings', 'collections', 'checks', 'storefrontUrl']

/**
 * Form values from a stored product (or an empty one). Read-only parts that the screen shows (a picture's `image`, a variant's stock) stay in the values and are removed by `toBody`.
 * @param {import('./api').AdminProduct | null} product
 */
export function toForm(product) {
  if (!product) return emptyProduct()
  return Object.fromEntries(Object.entries(product).filter(([k]) => !readOnly.includes(k)))
}

/** @param {object} variant */
const variantBody = (variant) => Object.fromEntries(Object.entries(variant).filter(([k]) => !['stockStatus', 'onHand', 'reserved', 'hasOrders'].includes(k)))

/**
 * The document the API accepts: no empty strings or objects, none of the read-only parts.
 * @param {Record<string, any>} values
 */
export function toBody(values) {
  return prune({
    ...values,
    media: (values.media ?? []).map((/** @type {object} */ m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'image'))),
    variants: (values.variants ?? []).map(variantBody),
  })
}
