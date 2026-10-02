// Shared contract (doc 03). The admin publishes shapes that satisfy these
// schemas; the storefront's future BFF will parse() every response against
// the same file. Keep this file byte-for-byte portable to the storefront repo.
import { z } from 'zod'

// ---------------------------------------------------------------- money ---
export const Money = z.object({
  amount: z.number().int(), // minor units (paisa for PKR, exponent 2)
  currency: z.string().length(3),
})
export const money = (rupees, currency = 'PKR') => ({ amount: Math.round(rupees * 100), currency })

// --------------------------------------------------------------- shared ---
export const ColorFamily = z.enum([
  'black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange',
  'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'multi',
])

export const HexSwatch = z.object({ hex: z.array(z.string().regex(/^#([0-9a-f]{6})$/i)).min(1).max(3) })
export const MediaSwatch = z.object({ mediaId: z.string() })
export const Swatch = z.union([HexSwatch, MediaSwatch])

export const Colorway = z.object({
  label: z.string(),
  family: ColorFamily,
  swatch: Swatch,
})

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

// Admin-managed product gallery: uploaded from the device or linked by URL. `sortOrder` is the
// gallery order; exactly one image should be isPrimary (the storefront shows it first, on cards too).
// Independent of `media` on purpose (media keeps roles/video for the richer PDP).
export const ProductImage = z.object({
  id: z.string(),
  url: z.string().min(1),
  alt: z.string().default(''),
  sortOrder: z.number().int(),
  isPrimary: z.boolean().default(false),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

// -------------------------------------------------------------- product ---
export const ProductKind = z.enum([
  'stitched', 'unstitched', 'made-to-order', 'footwear',
  'accessory', 'bundle', 'home', 'beauty',
])

export const Component = z.object({
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

export const StockStatus = z.enum(['in_stock', 'low_stock', 'sold_out', 'made_to_order', 'preorder'])

export const Variant = z.object({
  id: z.string(),
  sku: z.string(),
  optionValueIds: z.array(z.string()),
  price: Money,
  compareAt: Money.optional(),
  stock: z.object({
    status: StockStatus,
    quantity: z.number().int().nonnegative().optional(),
    maxPerOrder: z.number().int().positive().default(10),
  }),
  mediaIds: z.array(z.string()).optional(),
})

export const OptionValue = z.object({
  id: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  kind: z.enum(['standard', 'unstitched', 'custom', 'free']).default('standard'),
  swatch: Swatch.optional(),
})

export const ProductOption = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['size', 'color', 'material', 'other']),
  display: z.enum(['buttons', 'swatch', 'select']).default('buttons'),
  sizeSystemId: z.string().optional(),
  values: z.array(OptionValue).min(1),
})

export const Fit = z.object({
  modelHeightCm: z.number().optional(),
  modelWears: z.string().optional(),
  note: z.enum(['runs_small', 'true_to_size', 'runs_large']).optional(),
  cut: z.enum(['regular', 'relaxed', 'oversized', 'slim']).optional(),
})

export const MadeToOrder = z.object({
  leadTime: z.object({ minDays: z.number().int(), maxDays: z.number().int(), label: z.string() }),
  returnable: z.boolean(),
  depositPercent: z.number().optional(),
})

export const SiblingRef = z.object({
  productId: z.string(),
  handle: z.string(),
  colorway: Colorway,
  thumbnailMediaId: z.string(),
})

export const Product = z.object({
  id: z.string(),
  handle: z.string(),
  styleId: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'archived']),
  publishedAt: z.string().optional(),
  kind: ProductKind,
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
  fit: Fit.optional(),
  madeToOrder: MadeToOrder.optional(),
  care: z.array(z.string()).optional(),
  badges: z.array(z.enum(['new', 'sale', 'bestseller', 'limited', 'made-to-order', 'sold-out'])).optional(),
  relatedIds: z.array(z.string()).optional(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
})

// ------------------------------------------------------------ taxonomy ---
export const Category = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  parentId: z.string().nullable().optional(),
  filterSchema: z.array(z.string()).default([]),
  image: Media.optional(),
})

export const Collection = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  description: z.string().optional(),
  productIds: z.array(z.string()).default([]),
  status: z.enum(['draft', 'active']).default('active'),
})

export const AttributeDefinition = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['enum', 'number', 'boolean', 'color']),
  display: z.enum(['checkbox', 'swatch', 'buttons', 'range']),
  values: z.array(z.object({
    id: z.string(),
    label: z.string(),
    sortOrder: z.number().int(),
    swatch: Swatch.optional(),
  })),
  filterable: z.boolean(),
  group: z.string().optional(),
})

// ----------------------------------------------------------------- size ---
export const SizeSystem = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.object({ id: z.string(), label: z.string(), sortOrder: z.number().int() })),
})

export const SizeChart = z.object({
  id: z.string(),
  title: z.string(),
  unit: z.enum(['in', 'cm']),
  notes: z.string().optional(),
  tables: z.array(z.object({
    id: z.string(),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.object({ label: z.string(), values: z.array(z.number()) })),
  })),
})

export const FormField = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'tel', 'email', 'number', 'select', 'textarea', 'checkbox']),
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  pattern: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  unit: z.enum(['in', 'cm']).optional(),
  helpText: z.string().optional(),
})

export const FormSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  fields: z.array(FormField),
  allowNotes: z.boolean().optional(),
})

// ------------------------------------------------------------- storeconfig
export const ThemeTokens = z.object({
  colors: z.object({
    bg: z.string(), surface: z.string(), fg: z.string(), muted: z.string(),
    line: z.string(), accent: z.string(), onAccent: z.string().optional(),
    sale: z.string(), success: z.string(), warning: z.string(), danger: z.string(), focus: z.string(),
  }),
  fonts: z.object({ heading: z.string(), body: z.string() }),
  radius: z.object({
    control: z.enum(['sharp', 'soft', 'round']),
    card: z.enum(['sharp', 'soft', 'round']),
    media: z.enum(['none', 'soft']),
  }),
  density: z.enum(['comfortable', 'compact']),
  mediaRatio: z.enum(['3/4', '2/3', '4/5', '1/1']),
  header: z.object({ layout: z.enum(['left', 'center']), sticky: z.boolean() }),
})

export const StoreConfig = z.object({
  brand: z.object({
    name: z.string(),
    logo: z.object({ light: z.string(), dark: z.string().optional() }),
    favicon: z.string().optional(),
    tagline: z.string().optional(),
  }),
  theme: ThemeTokens,
  locale: z.object({
    default: z.string(), supported: z.array(z.string()),
    currency: z.string(), direction: z.enum(['ltr', 'rtl']),
  }),
  priceDisplay: z.object({ showDecimals: z.boolean(), rounding: z.enum(['none', 'nearest', 'up']) }),
  notices: z.array(z.object({
    id: z.string(), text: z.string(), href: z.string().optional(),
    severity: z.enum(['info', 'promo', 'notice']), startsAt: z.string().optional(), endsAt: z.string().optional(),
  })),
  contact: z.object({
    whatsapp: z.string(), phone: z.string(), email: z.string(), address: z.string(),
    mapUrl: z.string().optional(), socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
  }),
  shipping: z.object({
    zones: z.array(z.object({
      id: z.string(), name: z.string(), cities: z.array(z.string()),
      methods: z.array(z.object({
        id: z.string(), label: z.string(), fee: Money, freeAbove: Money.optional(),
        etaDays: z.tuple([z.number(), z.number()]),
      })),
    })),
    codLimit: Money.optional(),
  }),
  payments: z.array(z.object({
    id: z.string(), type: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'bnpl']),
    label: z.string(), enabled: z.boolean(), description: z.string().optional(),
  })),
  checkout: z.object({ guest: z.boolean(), fields: FormSchema }),
  features: z.object({
    wishlist: z.boolean(), reviews: z.boolean(), notifyMe: z.boolean(),
    customSizing: z.boolean(), findMySize: z.boolean(), compare: z.boolean(), multiCurrency: z.boolean(),
  }),
  policies: z.object({
    returns: z.string().optional(), shipping: z.string().optional(),
    privacy: z.string().optional(), terms: z.string().optional(),
  }),
})

// ---------------------------------------------------------- site settings
// What the storefront shell reads at boot: title, logo, favicon, home hero carousel.
// Same shape as the API's /api/public/settings (mock-api/schemas.js).
export const HeroSlide = z.object({
  id: z.string().optional(),
  imageUrl: z.string().min(1, 'Add an image'),
  heading: z.string().trim().min(1, 'Heading is required'),
  subheading: z.string().default(''),
  buttonText: z.string().default(''),
  buttonLink: z.string().default(''),
  sortOrder: z.number().int(),
})

// A home-page content block below the hero; `enabled: false` hides it on the storefront.
export const HomeBanner = z.object({
  enabled: z.boolean().default(true),
  eyebrow: z.string().default(''),
  heading: z.string().default(''),
  text: z.string().default(''),
  buttonText: z.string().default(''),
  buttonLink: z.string().default(''),
})

export const SiteSettings = z.object({
  siteTitle: z.string().trim().min(1, 'Website title is required'),
  logoUrl: z.string().default(''),
  faviconUrl: z.string().default(''),
  announcement: z.string().default(''), // storefront top bar; empty hides it
  heroSlides: z.array(HeroSlide).default([]),
  promo: HomeBanner.default({}),
  editorial: HomeBanner.extend({ imageUrl: z.string().default('') }).default({}),
  footer: z.object({
    about: z.string().default(''),
    phone: z.string().default(''),
    email: z.string().default(''),
  }).default({}),
})

// -------------------------------------------------------- pages / menus ---
export const MenuItem = z.object({
  id: z.string(), label: z.string(), href: z.string(),
  children: z.array(z.lazy(() => MenuItem)).optional(),
})
export const Menu = z.object({ id: z.string(), handle: z.string(), items: z.array(MenuItem) })

export const CmsPage = z.object({
  id: z.string(), slug: z.string(), title: z.string(),
  status: z.enum(['draft', 'active']),
  bodyMd: z.string(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
})

export const Block = z.object({ id: z.string(), type: z.string(), settings: z.record(z.unknown()) })
export const Section = z.object({
  id: z.string(), type: z.string(), settings: z.record(z.unknown()),
  blocks: z.record(Block).default({}), blockOrder: z.array(z.string()).default([]),
  disabled: z.boolean().optional(),
})
export const PageTemplate = z.object({
  id: z.string(),
  type: z.enum(['home', 'category', 'collection', 'product', 'page', 'cart', 'search']),
  sections: z.record(Section),
  order: z.array(z.string()),
})

// ------------------------------------------------------------- commerce ---
export const Promo = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(['percent', 'flat', 'free_shipping']),
  value: z.number(),
  minSpend: Money.optional(),
  usageLimit: z.number().int().optional(),
  usageCount: z.number().int().default(0),
  perCustomerLimit: z.number().int().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(['active', 'scheduled', 'expired', 'disabled']),
  appliesTo: z.object({
    scope: z.enum(['all', 'categories', 'products']).default('all'),
    categoryIds: z.array(z.string()).default([]),
    productIds: z.array(z.string()).default([]),
  }).optional(),
})

export const OrderLine = z.object({
  productId: z.string(), variantId: z.string(), title: z.string(), variantLabel: z.string(),
  sku: z.string(), qty: z.number().int(), price: Money, mediaUrl: z.string().optional(),
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
  internalNotes: z.string().optional(), // admin-only, never sent to storefront
})

export const Review = z.object({
  id: z.string(), productId: z.string(), author: z.string(), rating: z.number().int().min(1).max(5),
  title: z.string().optional(), body: z.string(), fit: z.enum(['runs_small', 'true_to_size', 'runs_large']).optional(),
  photos: z.array(z.string()).default([]), status: z.enum(['pending', 'approved', 'rejected']), createdAt: z.string(),
  reply: z.object({ body: z.string(), createdAt: z.string() }).optional(),
})

export const collections = {
  products: Product, categories: Category, collectionsList: Collection, attributes: AttributeDefinition,
  sizeCharts: SizeChart, sizeSystems: SizeSystem, orders: Order, promos: Promo, pages: CmsPage,
  menus: Menu, reviews: Review, templates: PageTemplate, formSchemas: FormSchema,
}