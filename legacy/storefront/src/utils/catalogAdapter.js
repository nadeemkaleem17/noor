// Maps the shared contract shape (admin-panel/src/contract/schemas.js, served by the API)
// onto the flat product shape the storefront pages were built around:
//   { id, name, category, subcategory, price, compareAt, stock, sizes, sku, description, tags, swatch, images }
// Keeping the translation here means no page has to know which source the catalog came from.
import { placeholderImage } from './images'

const AVAILABLE_WITHOUT_COUNT = ['made_to_order', 'preorder']

// Stable small integer from a string, so API products get a consistent fallback gradient.
function hashIndex(str) {
  let h = 0
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

const toRupees = (money) => (money && Number.isFinite(money.amount) ? money.amount / 100 : undefined)

// images[] (url, alt, sortOrder, isPrimary) wins; older payloads only carry media[].
// Result: [{ url, alt }] with the primary image first, then by sortOrder.
export function galleryFromContract(product) {
  const images = Array.isArray(product.images) ? product.images.filter((i) => i?.url) : []
  if (images.length) {
    return [...images]
      .sort((a, b) => (b.isPrimary === true) - (a.isPrimary === true) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((i) => ({ url: i.url, alt: i.alt || product.title }))
  }
  return (product.media || [])
    .filter((m) => m?.type === 'image' && m.url)
    .map((m) => ({ url: m.url, alt: m.alt || product.title }))
}

// Contract categories are a flat list with parentId; the storefront wants top-level
// categories with their children's names.
export function categoryTreeFromContract(categories) {
  const roots = categories.filter((c) => !c.parentId)
  return roots.map((root) => ({
    name: root.name,
    subcategories: categories.filter((c) => c.parentId === root.id).map((c) => c.name),
  }))
}

function placeCategory(categoryId, byId) {
  const cat = byId.get(categoryId)
  if (!cat) return { category: 'Other', subcategory: undefined }
  let root = cat
  const seen = new Set()
  while (root.parentId && byId.has(root.parentId) && !seen.has(root.id)) {
    seen.add(root.id)
    root = byId.get(root.parentId)
  }
  return { category: root.name, subcategory: root === cat ? undefined : cat.name }
}

function stockOf(variants) {
  return variants.reduce((sum, v) => {
    const s = v.stock || {}
    if (s.status === 'sold_out') return sum
    if (AVAILABLE_WITHOUT_COUNT.includes(s.status)) return sum + (s.maxPerOrder ?? 1)
    return sum + (Number.isFinite(s.quantity) ? s.quantity : 0)
  }, 0)
}

export function productFromContract(product, byId) {
  const variants = Array.isArray(product.variants) ? product.variants : []
  const cheapest = variants.reduce((min, v) => (min && toRupees(min.price) <= toRupees(v.price) ? min : v), null)
  const sizeOption = (product.options || []).find((o) => o.role === 'size')
  const sizes = sizeOption ? [...sizeOption.values].sort((a, b) => a.sortOrder - b.sortOrder).map((v) => v.label) : undefined
  const compareAt = toRupees(cheapest?.compareAt)
  const price = toRupees(cheapest?.price) ?? 0
  const sizeLabelOf = (v) => sizeOption?.values.find((o) => v.optionValueIds?.includes(o.id))?.label ?? null
  return {
    id: product.id,
    name: product.title,
    ...placeCategory(product.primaryCategoryId, byId),
    price,
    compareAt: compareAt && compareAt > price ? compareAt : undefined,
    stock: stockOf(variants),
    sizes: sizes?.length ? sizes : undefined,
    sku: cheapest?.sku || '',
    description: product.descriptionMd || product.subtitle || '',
    tags: (product.badges || []).filter((b) => b === 'new' || b === 'bestseller'),
    swatch: hashIndex(product.id),
    images: galleryFromContract(product),
    // Buyable variants, so the product page can show per-size price/stock and checkout can
    // send the exact variant the API expects. (Mock products have none; pages fall back to price/stock.)
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: sizeLabelOf(v),
      price: toRupees(v.price) ?? price,
      compareAt: toRupees(v.compareAt),
      stock: stockOf([v]),
    })),
  }
}

// The variant a shopper is buying: the one for the chosen size (preferring one in stock, for
// products that also vary by colour), or the first in-stock variant when the product has no sizes.
export function variantFor(product, size) {
  const list = product?.variants
  if (!list?.length) return null
  const candidates = size ? list.filter((v) => v.size === size) : list
  return candidates.find((v) => v.stock > 0) || candidates[0] || null
}

export function catalogFromContract(products, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const tree = categoryTreeFromContract(categories)
  return {
    products: products.map((p) => productFromContract(p, byId)),
    categoryTree: tree,
    categories: tree.map((c) => c.name),
  }
}

// Mock products carry a `gallery` count instead of real photos; give them the same
// images[] shape (seeded placeholders, same seeds as before) so pages have one code path.
export function withMockImages(product) {
  if (Array.isArray(product.images) && product.images.length) return product
  const count = Math.max(1, product.gallery || 1)
  return {
    ...product,
    images: Array.from({ length: count }, (_, i) => ({
      url: placeholderImage(`${product.id}-${i}`, 800, 1000),
      alt: `${product.name} — image ${i + 1}`,
    })),
  }
}
