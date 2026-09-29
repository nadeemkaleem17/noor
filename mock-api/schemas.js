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

// Admin-managed gallery (uploaded or linked images). Exactly one should be isPrimary.
export const ProductImage = z.object({
  id: z.string(),
  url: z.string().min(1),
  alt: z.string().default(''),
  sortOrder: z.number().int(),
  isPrimary: z.boolean().default(false),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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
  images: z.array(ProductImage).default([]),
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
  id: z.string().optional(), // stable key for the admin's reorder UI
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

// Orders (copied from the contract). The storefront creates them; the admin moves them through statuses.
export const OrderLine = z.object({
  productId: z.string(), variantId: z.string(), title: z.string(), variantLabel: z.string(),
  sku: z.string(), qty: z.number().int().positive(), price: Money, mediaUrl: z.string().optional(),
  customization: z.record(z.unknown()).optional(),
})

export const Order = z.object({
  id: z.string(),
  orderNo: z.string(),
  status: z.enum(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned']),
  createdAt: z.string(),
  customer: z.object({ name: z.string(), phone: z.string(), email: z.string().optional() }),
  shippingAddress: z.object({
    address: z.string(), city: z.string(), landmark: z.string().optional(), notes: z.string().optional(),
  }),
  lines: z.array(OrderLine).min(1),
  promoCode: z.string().optional(),
  subtotal: Money,
  discount: Money.optional(),
  shippingFee: Money,
  total: Money,
  paymentMethod: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'bnpl']),
  invoiceNo: z.string().optional(),
  dispatch: z.object({ courier: z.string(), trackingNo: z.string().optional(), dispatchedAt: z.string() }).optional(),
  history: z.array(z.object({ status: z.string(), at: z.string(), note: z.string().optional() })).optional(),
  internalNotes: z.string().optional(), // admin-only, never sent to the storefront
})

// What the storefront may send at checkout; the server fills in id, orderNo, status, dates.
export const OrderInput = Order.omit({
  id: true, orderNo: true, status: true, createdAt: true, invoiceNo: true, dispatch: true, history: true, internalNotes: true,
}).extend({
  customer: Order.shape.customer.extend({ name: z.string().trim().min(1), phone: z.string().trim().min(7) }),
  shippingAddress: Order.shape.shippingAddress.extend({ address: z.string().trim().min(1), city: z.string().trim().min(1) }),
})
