// Copied from admin-panel/src/contract/fixtures.js (subset: 5 products of different kinds).
// Prices are Money in minor units: 699000 = Rs. 6,990.
const pkr = (amount) => ({ amount, currency: 'PKR' })
const img = (id, alt, role = 'model') => ({
  id, type: 'image', url: `https://picsum.photos/seed/${id}/900/1200`, alt, width: 900, height: 1200, role,
})
const sizes = (ids) => ids.map((id, i) => ({ id, label: id.toUpperCase(), sortOrder: i, kind: 'standard' }))

export const categories = [
  { id: 'cat_women', handle: 'women', name: 'Women', parentId: null, filterSchema: ['fabric', 'piece', 'occasion'] },
  { id: 'cat_unstitched', handle: 'unstitched', name: 'Unstitched', parentId: 'cat_women', filterSchema: ['fabric', 'piece'] },
  { id: 'cat_stitched', handle: 'stitched', name: 'Stitched', parentId: 'cat_women', filterSchema: ['fabric', 'piece', 'occasion'] },
  { id: 'cat_bridal', handle: 'bridal', name: 'Bridal & Formals', parentId: 'cat_women', filterSchema: ['fabric', 'occasion'] },
  { id: 'cat_footwear', handle: 'footwear', name: 'Footwear', parentId: null, filterSchema: ['material'] },
  { id: 'cat_accessories', handle: 'accessories', name: 'Accessories', parentId: null, filterSchema: ['material'] },
  { id: 'cat_men', handle: 'men', name: 'Men', parentId: null, filterSchema: ['fabric'] },
  { id: 'cat_kids', handle: 'kids', name: 'Kids', parentId: null, filterSchema: ['fabric'] },
]

const euSizes = ['36', '37', '38', '39', '40', '41'].map((l, i) => ({ id: `eu${l}`, label: l, sortOrder: i, kind: 'standard' }))

export const products = [
  {
    id: 'p1', handle: 'noor-embroidered-lawn-3pc', status: 'active', publishedAt: '2026-08-01T00:00:00Z',
    kind: 'stitched', title: 'Noor Embroidered Lawn 3-Piece', subtitle: 'Shirt, dupatta & trouser',
    primaryCategoryId: 'cat_stitched', categoryIds: ['cat_stitched', 'cat_women'], collectionIds: ['col_sale'],
    descriptionMd: 'Embroidered lawn shirt with chiffon dupatta and dyed trouser.',
    highlights: ['Hand-embellished neckline', 'Pure chiffon dupatta', 'Pre-shrunk fabric'],
    components: [
      { id: 'c1', type: 'shirt', label: 'Embroidered shirt', fabric: 'Lawn', included: true },
      { id: 'c2', type: 'dupatta', label: 'Chiffon dupatta', fabric: 'Chiffon', included: true },
      { id: 'c3', type: 'trouser', label: 'Dyed trouser', fabric: 'Cambric', included: true },
    ],
    attributes: { fabric: ['lawn'], piece: ['3'], occasion: ['casual', 'festive'] },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: sizes(['xs', 's', 'm', 'l', 'xl']) }],
    variants: ['xs', 's', 'm', 'l', 'xl'].map((s, i) => ({
      id: `p1-${s}`, sku: `NOR-3PC-${s.toUpperCase()}`, optionValueIds: [s], price: pkr(699000), compareAt: pkr(899000),
      stock: { status: i === 4 ? 'low_stock' : 'in_stock', quantity: i === 4 ? 3 : 20, maxPerOrder: 10 },
    })),
    media: [img('p1-1', 'Noor 3-piece, front'), img('p1-2', 'Noor 3-piece, detail', 'detail'), img('p1-3', 'Noor 3-piece, back')],
    sizeChartId: 'chart_alpha', badges: ['sale'],
  },
  {
    id: 'p3', handle: 'raaz-unstitched-lawn-3pc', status: 'active', publishedAt: '2026-07-20T00:00:00Z',
    kind: 'unstitched', title: 'Raaz Unstitched Lawn 3-Piece', primaryCategoryId: 'cat_unstitched',
    categoryIds: ['cat_unstitched', 'cat_women'], collectionIds: ['col_new'],
    descriptionMd: 'Unstitched lawn suit — cut piece by piece.',
    components: [
      { id: 'c1', type: 'shirt', label: 'Shirt fabric', fabric: 'Lawn', quantity: '2.5 m', included: true },
      { id: 'c2', type: 'dupatta', label: 'Dupatta', fabric: 'Chiffon', quantity: '2.5 m', included: true },
      { id: 'c3', type: 'trouser', label: 'Trouser fabric', fabric: 'Cambric', quantity: '2.5 m', included: true },
    ],
    attributes: { fabric: ['lawn'], piece: ['3'], occasion: ['casual'] }, options: [],
    variants: [{ id: 'p3-1', sku: 'RAZ-UNS-3PC', optionValueIds: [], price: pkr(549000), stock: { status: 'in_stock', quantity: 40, maxPerOrder: 10 } }],
    media: [img('p3-1', 'Raaz unstitched, flat lay', 'flat')], badges: ['new'],
  },
  {
    id: 'p4', handle: 'amani-bridal-made-to-order', status: 'active', publishedAt: '2026-06-01T00:00:00Z',
    kind: 'made-to-order', title: 'Amani Bridal Ensemble', subtitle: 'Made to order', primaryCategoryId: 'cat_bridal',
    categoryIds: ['cat_bridal', 'cat_women'], collectionIds: ['col_eid'],
    descriptionMd: 'Hand-embellished bridal shirt with organza dupatta. 6-week lead time.',
    components: [
      { id: 'c1', type: 'shirt', label: 'Hand-embellished shirt', fabric: 'Organza', technique: 'Zardozi', included: true },
      { id: 'c2', type: 'dupatta', label: 'Embellished dupatta', fabric: 'Net', included: true },
      { id: 'c3', type: 'lehnga', label: 'Lehnga', fabric: 'Raw silk', included: true },
    ],
    attributes: { fabric: ['organza', 'silk'], occasion: ['bridal'] },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha',
      values: [...sizes(['xs', 's', 'm', 'l', 'xl']), { id: 'custom', label: 'Custom', sortOrder: 5, kind: 'custom' }] }],
    variants: ['xs', 's', 'm', 'l', 'xl'].map((s) => ({
      id: `p4-${s}`, sku: `AMN-BRD-${s.toUpperCase()}`, optionValueIds: [s], price: pkr(4800000), stock: { status: 'made_to_order', maxPerOrder: 2 },
    })).concat([{ id: 'p4-custom', sku: 'AMN-BRD-CUSTOM', optionValueIds: ['custom'], price: pkr(5200000), stock: { status: 'made_to_order', maxPerOrder: 1 } }]),
    media: [img('p4-1', 'Amani bridal, front'), img('p4-2', 'Amani bridal, detail', 'detail')],
    sizeChartId: 'chart_bridal', customSizeSchemaId: 'form_custom_size',
    madeToOrder: { leadTime: { minDays: 35, maxDays: 42, label: '5–6 weeks' }, returnable: false, depositPercent: 50 },
    badges: ['made-to-order'],
  },
  {
    id: 'p7', handle: 'sana-khussa', status: 'active', publishedAt: '2026-08-02T00:00:00Z',
    kind: 'footwear', title: 'Sana Embroidered Khussa', primaryCategoryId: 'cat_footwear', categoryIds: ['cat_footwear'], collectionIds: [],
    descriptionMd: 'Hand-embroidered khussa, EU sizing.', components: [], attributes: { material: ['fabric'] },
    options: [
      { id: 'opt_size', name: 'Size', role: 'size', display: 'select', sizeSystemId: 'sys_eu', values: euSizes },
      { id: 'opt_color', name: 'Color', role: 'color', display: 'swatch', values: [
        { id: 'gold', label: 'Gold', sortOrder: 0, kind: 'standard', swatch: { hex: ['#c9a13b'] } },
        { id: 'black', label: 'Black', sortOrder: 1, kind: 'standard', swatch: { hex: ['#161616'] } },
      ] },
    ],
    variants: euSizes.flatMap((sz) => ['gold', 'black'].map((c) => ({
      id: `p7-${sz.id}-${c}`, sku: `KHU-${sz.label}-${c.slice(0, 2).toUpperCase()}`, optionValueIds: [sz.id, c],
      price: pkr(320000), stock: { status: 'in_stock', quantity: 15, maxPerOrder: 10 },
    }))),
    media: [img('p7-1', 'Sana khussa, gold')],
  },
  {
    id: 'p9', handle: 'nadia-embroidered-clutch', status: 'active', publishedAt: '2026-08-05T00:00:00Z',
    kind: 'accessory', title: 'Nadia Embroidered Clutch', primaryCategoryId: 'cat_accessories', categoryIds: ['cat_accessories'], collectionIds: [],
    descriptionMd: 'Hand-embroidered evening clutch, 22 × 12 cm.', components: [], attributes: { material: ['fabric'] }, options: [],
    variants: [{ id: 'p9-1', sku: 'CLU-NAD-001', optionValueIds: [], price: pkr(380000), stock: { status: 'in_stock', quantity: 25, maxPerOrder: 10 } }],
    media: [img('p9-1', 'Nadia clutch')],
  },
]

export const settings = {
  siteTitle: 'Noor & Co.',
  logoUrl: '',
  faviconUrl: '',
  announcement: 'Free delivery on orders over Rs 5,000 · Cash on delivery available nationwide',
  promo: {
    enabled: true, eyebrow: 'Limited time', heading: '10% off your first order',
    text: 'Use code RUBAYA10 at checkout on orders above Rs 3,000.', buttonText: 'Start shopping', buttonLink: '/shop',
  },
  editorial: {
    enabled: true, eyebrow: 'The edit', heading: 'Festive dressing, made effortless.',
    text: 'From everyday lawn to occasion-ready formals — our stylists picked the pieces that carry a look from morning tea to evening mehndi without a wardrobe change.',
    imageUrl: 'https://picsum.photos/seed/editorial-story/900/700', buttonText: 'Shop the story', buttonLink: '/shop',
  },
  footer: {
    about: 'Contemporary Pakistani fashion — lawn, formals and accessories made to last, delivered nationwide.',
    phone: '0300-1112233', email: 'hello@noor.co',
  },
  heroSlides: [
    { imageUrl: 'https://picsum.photos/seed/hero-1/1600/700', heading: 'Festive Edit, 2026', subheading: 'Hand-embroidered lawn & luxury pret', buttonText: 'Shop now', buttonLink: '/collections/festive', sortOrder: 0 },
    { imageUrl: 'https://picsum.photos/seed/hero-2/1600/700', heading: 'Made to order, made for you', subheading: 'Custom sizing on every bridal piece', buttonText: 'Explore bridal', buttonLink: '/c/women/bridal', sortOrder: 1 },
  ],
}

// Every seeded product also gets an admin-style images[] gallery built from its media (first = main).
for (const p of products) {
  p.images = p.media.map((m, i) => ({
    id: `${m.id}-img`, url: m.url, alt: m.alt, sortOrder: i, isPrimary: i === 0, width: m.width, height: m.height,
  }))
}

// Copied from the contract fixtures (seedOrders). Line prices are Money in minor units.
export const orders = [
  {
    id: 'o1', orderNo: 'SF-10231', status: 'pending', createdAt: '2026-09-21T09:12:00Z',
    customer: { name: 'Amna Raza', phone: '0301-2345678', email: 'amna@example.com' },
    shippingAddress: { address: 'House 12, Street 4, DHA Phase 5', city: 'Karachi', landmark: 'Near Sunset Mall' },
    lines: [{ productId: 'p1', variantId: 'p1-m', title: 'Noor Embroidered Lawn 3-Piece', variantLabel: 'M', sku: 'NOR-3PC-M', qty: 1, price: pkr(699000) }],
    subtotal: pkr(699000), shippingFee: pkr(25000), total: pkr(724000), paymentMethod: 'cod',
  },
  {
    id: 'o2', orderNo: 'SF-10230', status: 'confirmed', createdAt: '2026-09-20T15:40:00Z',
    customer: { name: 'Bilal Ahmed', phone: '0333-1122334' },
    shippingAddress: { address: 'Flat 3B, Gulberg III', city: 'Lahore' },
    lines: [{ productId: 'p4', variantId: 'p4-custom', title: 'Amani Bridal Ensemble', variantLabel: 'Custom', sku: 'AMN-BRD-CUSTOM', qty: 1, price: pkr(5200000), customization: { chest: 38, waist: 32, shoulder: 15, length: 56 } }],
    promoCode: 'EID25', subtotal: pkr(5200000), discount: pkr(1300000), shippingFee: pkr(0), total: pkr(3900000), paymentMethod: 'bank_transfer', invoiceNo: 'INV-2026-0142',
  },
  {
    id: 'o3', orderNo: 'SF-10229', status: 'dispatched', createdAt: '2026-09-19T11:05:00Z',
    customer: { name: 'Sara Khan', phone: '0345-9988776' },
    shippingAddress: { address: 'E-11/2', city: 'Islamabad' },
    lines: [
      { productId: 'p9', variantId: 'p9-1', title: 'Nadia Embroidered Clutch', variantLabel: '—', sku: 'CLU-NAD-001', qty: 1, price: pkr(380000) },
    ],
    subtotal: pkr(380000), shippingFee: pkr(0), total: pkr(380000), paymentMethod: 'cod', invoiceNo: 'INV-2026-0141',
    dispatch: { courier: 'TCS', trackingNo: 'TCS-55019', dispatchedAt: '2026-09-20T10:00:00Z' },
  },
  {
    id: 'o4', orderNo: 'SF-10228', status: 'delivered', createdAt: '2026-09-14T08:00:00Z',
    customer: { name: 'Hina Malik', phone: '0312-4455667' },
    shippingAddress: { address: 'Model Town', city: 'Lahore' },
    lines: [{ productId: 'p3', variantId: 'p3-1', title: 'Raaz Unstitched Lawn 3-Piece', variantLabel: '—', sku: 'RAZ-UNS-3PC', qty: 1, price: pkr(549000) }],
    subtotal: pkr(549000), shippingFee: pkr(25000), total: pkr(574000), paymentMethod: 'card', invoiceNo: 'INV-2026-0139',
  },
]
