// Copied from admin-panel/src/contract/schemas.js (product + category subset).
// Keep in sync by hand; this project deliberately does not import across folders.
import { z } from 'zod'

export const Money = z.object({
  amount: z.number().int(), // minor units (paisa for PKR)
  currency: z.string().length(3),
})

const ColorFamily = z.enum([
  'black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange',
  'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'multi',
])
const HexSwatch = z.object({ hex: z.array(z.string().regex(/^#([0-9a-f]{6})$/i)).min(1).max(3) })
const Swatch = z.union([HexSwatch, z.object({ mediaId: z.string() })])
const Colorway = z.object({ label: z.string(), family: ColorFamily, swatch: Swatch })

export const Media = z.object({
  id: z.string(),
  type: z.enum(['image', 'video']),
  url: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  lqip: z.string().optional(),
  role: z.enum(['model', 'flat', 'detail', 'lifestyle', 'swatch']).optional(),
  colorwayHint: z.string().optional(),
  poster: z.string().optional(),
  durationSec: z.number().optional(),
})

const Component = z.object({
  id: z.string(),
  type: z.enum(['shirt', 'dupatta', 'trouser', 'shalwar', 'slip', 'lehnga', 'blouse',
    'jacket', 'scarf', 'shoes', 'bag', 'other']),
  label: z.string(),
  fabric: z.string().optional(),
  color: z.object({ label: z.string(), family: ColorFamily }).optional(),
  technique: z.string().optional(),
  quantity: z.string().optional(),
  included: z.boolean().default(true),
})

const Variant = z.object({
  id: z.string(),
  sku: z.string(),
  optionValueIds: z.array(z.string()),
  price: Money,
  compareAt: Money.optional(),
  stock: z.object({
    status: z.enum(['in_stock', 'low_stock', 'sold_out', 'made_to_order', 'preorder']),
    quantity: z.number().int().nonnegative().optional(),
    maxPerOrder: z.number().int().positive().default(10),
  }),
  mediaIds: z.array(z.string()).optional(),
})

const ProductOption = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['size', 'color', 'material', 'other']),
  display: z.enum(['buttons', 'swatch', 'select']).default('buttons'),
  sizeSystemId: z.string().optional(),
  values: z.array(z.object({
    id: z.string(),
    label: z.string(),
    sortOrder: z.number().int(),
    kind: z.enum(['standard', 'unstitched', 'custom', 'free']).default('standard'),
    swatch: Swatch.optional(),
  })).min(1),
})

export const Product = z.object({
  id: z.string(),
  handle: z.string(),
  styleId: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'archived']),
  publishedAt: z.string().optional(),
  kind: z.enum(['stitched', 'unstitched', 'made-to-order', 'footwear', 'accessory', 'bundle', 'home', 'beauty']),
  title: z.string(),
  subtitle: z.string().optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string(),
  categoryIds: z.array(z.string()),
  collectionIds: z.array(z.string()),
  descriptionMd: z.string().optional(),
  highlights: z.array(z.string()).max(6).optional(),
  components: z.array(Component).default([]),
  attributes: z.record(z.array(z.string())),
  colorway: Colorway.optional(),
  options: z.array(ProductOption).max(3),
  variants: z.array(Variant).min(1),
  media: z.array(Media).min(1),
  sizeChartId: z.string().optional(),
  customSizeSchemaId: z.string().optional(),
  fit: z.object({
    modelHeightCm: z.number().optional(),
    modelWears: z.string().optional(),
    note: z.enum(['runs_small', 'true_to_size', 'runs_large']).optional(),
    cut: z.enum(['regular', 'relaxed', 'oversized', 'slim']).optional(),
  }).optional(),
  madeToOrder: z.object({
    leadTime: z.object({ minDays: z.number().int(), maxDays: z.number().int(), label: z.string() }),
    returnable: z.boolean(),
    depositPercent: z.number().optional(),
  }).optional(),
  care: z.array(z.string()).optional(),
  badges: z.array(z.enum(['new', 'sale', 'bestseller', 'limited', 'made-to-order', 'sold-out'])).optional(),
  relatedIds: z.array(z.string()).optional(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
})

export const Category = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  parentId: z.string().nullable().optional(),
  filterSchema: z.array(z.string()).default([]),
  image: Media.optional(),
})

// Not in the contract yet: storefront site settings managed by the admin.
export const HeroSlide = z.object({
  imageUrl: z.string(),
  heading: z.string(),
  subheading: z.string().default(''),
  buttonText: z.string().default(''),
  buttonLink: z.string().default(''),
  sortOrder: z.number().int(),
})

export const Settings = z.object({
  siteTitle: z.string().min(1),
  logoUrl: z.string().default(''),
  faviconUrl: z.string().default(''),
  heroSlides: z.array(HeroSlide).default([]),
})
