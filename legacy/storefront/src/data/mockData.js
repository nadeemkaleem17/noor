// Category tree drives the mega-menu (header) and the "shop by category" grid on Home.
// Each top-level category maps 1:1 to the flat `category` string on products below,
// so existing filtering (Shop page, admin) keeps working unchanged.
export const CATEGORY_TREE = [
  { name: 'Lawn Suits', subcategories: ['Embroidered', 'Printed', '3-piece', '2-piece'] },
  { name: 'Kurtas', subcategories: ['Chikankari', 'Casual', 'Karandi', 'Cambric'] },
  { name: 'Dupattas', subcategories: ['Net', 'Chiffon', 'Organza'] },
  { name: 'Footwear', subcategories: ['Khussa', 'Heels', 'Sandals'] },
  { name: 'Accessories', subcategories: ['Jewellery', 'Bags', 'Clutches'] },
]

export const CATEGORIES = CATEGORY_TREE.map((c) => c.name)

// Deterministic placeholder art: each product gets a gradient + initial instead of a stock photo,
// which keeps the storefront looking intentional rather than broken-image links.
const palette = [
  ['#C9A227', '#8A6E1F'], ['#221F1C', '#4A443C'], ['#B23A2E', '#7A2A22'],
  ['#8A8378', '#5C564C'], ['#E8C766', '#C9A227'], ['#3F5A46', '#2A3D30'],
]

// `sizes` is optional (omit for one-size items like dupattas/accessories/unstitched suits).
// `tags` drives Home sections ('new', 'bestseller') and Shop sort ("Newest"/"Bestsellers").
// `stock` stays a single top-level number (matches the admin product form) — per-size stock
// is a Phase-2 concern once the admin panel grows a proper variant editor.
export const INITIAL_PRODUCTS = [
  { id: 'p1', name: 'Aaira Embroidered Lawn — 3pc', category: 'Lawn Suits', subcategory: 'Embroidered', price: 6490, compareAt: 7990, stock: 12, sku: 'RB-LN-101', description: 'Hand-embroidered front panel, dyed trouser and chiffon dupatta. Unstitched, cut on premium lawn.', swatch: 0, tags: ['bestseller'], gallery: 4 },
  { id: 'p2', name: 'Meher Printed Lawn — 2pc', category: 'Lawn Suits', subcategory: 'Printed', price: 3990, stock: 24, sku: 'RB-LN-102', description: 'Digital printed shirt with matching cotton trouser. Everyday festive wear.', swatch: 4, tags: ['new'], gallery: 3 },
  { id: 'p3', name: 'Zoya Karandi Kurta — Stitched', category: 'Kurtas', subcategory: 'Karandi', price: 2450, stock: 18, sku: 'RB-KU-201', description: 'Straight-cut karandi kurta with thread work neckline. True to size.', swatch: 1, sizes: ['S', 'M', 'L', 'XL'], tags: ['bestseller'], gallery: 3 },
  { id: 'p4', name: 'Sana Net Dupatta — Embellished', category: 'Dupattas', subcategory: 'Net', price: 1800, stock: 9, sku: 'RB-DP-301', description: 'Soft net dupatta finished with pearl border and four-sided lace.', swatch: 3, gallery: 2 },
  { id: 'p5', name: 'Rania Chikankari Kurta', category: 'Kurtas', subcategory: 'Chikankari', price: 3250, compareAt: 3900, stock: 6, sku: 'RB-KU-202', description: 'Lucknowi chikankari hand-embroidery on soft lawn, curved hem.', swatch: 5, sizes: ['S', 'M', 'L', 'XL'], tags: ['new'], gallery: 4 },
  { id: 'p6', name: 'Noor Khussa — Gold Tilla', category: 'Footwear', subcategory: 'Khussa', price: 2100, stock: 15, sku: 'RB-FT-401', description: 'Handcrafted Punjabi khussa with tilla thread work, cushioned sole.', swatch: 0, sizes: ['36', '37', '38', '39', '40', '41'], tags: ['bestseller'], gallery: 3 },
  { id: 'p7', name: 'Alveena Organza Dupatta', category: 'Dupattas', subcategory: 'Organza', price: 2600, stock: 0, sku: 'RB-DP-302', description: 'Crisp organza with hand-cut floral applique border.', swatch: 2, gallery: 2 },
  { id: 'p8', name: 'Kiran Pearl Jhumka Set', category: 'Accessories', subcategory: 'Jewellery', price: 1450, stock: 30, sku: 'RB-AC-501', description: 'Oxidised gold-tone jhumkas with freshwater pearl drops.', swatch: 1, tags: ['new'], gallery: 2 },
  { id: 'p9', name: 'Hania Digital Lawn — 3pc', category: 'Lawn Suits', subcategory: 'Printed', price: 5490, stock: 20, sku: 'RB-LN-103', description: 'Vibrant digital print with dyed trouser and printed voile dupatta.', swatch: 3, tags: ['new'], gallery: 4 },
  { id: 'p10', name: 'Warda Cambric Kurta', category: 'Kurtas', subcategory: 'Cambric', price: 2150, stock: 14, sku: 'RB-KU-203', description: 'Breathable cambric fabric, minimal button placket, A-line fit.', swatch: 4, sizes: ['S', 'M', 'L', 'XL'], gallery: 3 },
  { id: 'p11', name: 'Iqra Bridal Clutch — Gold', category: 'Accessories', subcategory: 'Clutches', price: 3200, stock: 8, sku: 'RB-AC-502', description: 'Structured box clutch with beadwork, detachable chain strap.', swatch: 0, tags: ['bestseller'], gallery: 3 },
  { id: 'p12', name: 'Sadaf Chiffon Dupatta', category: 'Dupattas', subcategory: 'Chiffon', price: 1950, stock: 22, sku: 'RB-DP-303', description: 'Lightweight chiffon in a tonal jacquard weave.', swatch: 5, gallery: 2 },
  { id: 'p13', name: 'Mahnoor Embroidered Lawn — 3pc', category: 'Lawn Suits', subcategory: 'Embroidered', price: 7290, stock: 10, sku: 'RB-LN-104', description: 'Fully embroidered front and sleeves, dyed trouser, embroidered net dupatta.', swatch: 2, tags: ['new', 'bestseller'], gallery: 4 },
  { id: 'p14', name: 'Anaya Heels — Nude Block', category: 'Footwear', subcategory: 'Heels', price: 3400, stock: 11, sku: 'RB-FT-402', description: 'Comfort block heel in nude synthetic leather, cushioned footbed.', swatch: 3, sizes: ['36', '37', '38', '39', '40'], gallery: 3 },
  { id: 'p15', name: 'Farah Beaded Sandals', category: 'Footwear', subcategory: 'Sandals', price: 2800, stock: 0, sku: 'RB-FT-403', description: 'Hand-beaded strap sandals with a low kitten heel.', swatch: 5, sizes: ['36', '37', '38', '39', '40'], gallery: 2 },
]

export function swatchColors(index) { return palette[index % palette.length] }

export const INITIAL_PROMO_CODES = [
  { id: 'promo1', code: 'RUBAYA10', type: 'percent', value: 10, minSpend: 3000, usageLimit: 200, used: 47, expiry: '2026-12-31', status: 'active' },
  { id: 'promo2', code: 'EIDFLAT500', type: 'flat', value: 500, minSpend: 5000, usageLimit: 100, used: 100, expiry: '2026-04-01', status: 'expired' },
]

// Read-only store configuration served to the storefront (owned by the admin project).
export const STORE_CONFIG = {
  storeName: 'Rubaya',
  subdomain: 'rubaya',
  theme: 'heritage-gold', // heritage-gold | monochrome | botanical
  phone: '0300-1112233',
  email: 'fahad@rubaya.pk',
  // Home/layout copy. The admin's Site settings override all of these when VITE_API_URL is set.
  announcement: 'Free delivery on orders over Rs 5,000 · Cash on delivery available nationwide',
  footerAbout: 'Contemporary Pakistani fashion — lawn, formals and accessories made to last, delivered nationwide.',
  promo: {
    enabled: true, eyebrow: 'Limited time', heading: '10% off your first order',
    text: 'Use code RUBAYA10 at checkout on orders above Rs 3,000.', buttonText: 'Start shopping', buttonLink: '/shop',
  },
  editorial: {
    enabled: true, eyebrow: 'The edit', heading: 'Festive dressing, made effortless.',
    text: 'From everyday lawn to occasion-ready formals — our stylists picked the pieces that carry a look from morning tea to evening mehndi without a wardrobe change.',
    imageUrl: '', buttonText: 'Shop the story', buttonLink: '/shop?category=Lawn+Suits',
  },
}
