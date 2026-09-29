import { money } from './schemas.js'

const img = (id, alt, role = 'model') => ({
  id, type: 'image', url: `https://picsum.photos/seed/${id}/900/1200`, alt,
  width: 900, height: 1200, role,
})

// ------------------------------------------------------------ taxonomy ---
export const seedCategories = [
  { id: 'cat_women', handle: 'women', name: 'Women', parentId: null, filterSchema: ['fabric', 'piece', 'occasion'] },
  { id: 'cat_unstitched', handle: 'unstitched', name: 'Unstitched', parentId: 'cat_women', filterSchema: ['fabric', 'piece'] },
  { id: 'cat_stitched', handle: 'stitched', name: 'Stitched', parentId: 'cat_women', filterSchema: ['fabric', 'piece', 'occasion'] },
  { id: 'cat_bridal', handle: 'bridal', name: 'Bridal & Formals', parentId: 'cat_women', filterSchema: ['fabric', 'occasion'] },
  { id: 'cat_footwear', handle: 'footwear', name: 'Footwear', parentId: null, filterSchema: ['material'] },
  { id: 'cat_accessories', handle: 'accessories', name: 'Accessories', parentId: null, filterSchema: ['material'] },
  { id: 'cat_men', handle: 'men', name: 'Men', parentId: null, filterSchema: ['fabric'] },
  { id: 'cat_kids', handle: 'kids', name: 'Kids', parentId: null, filterSchema: ['fabric'] },
]

export const seedCollections = [
  { id: 'col_new', handle: 'new-in', title: 'New In', description: 'Just landed.', productIds: [], status: 'active' },
  { id: 'col_sale', handle: 'sale', title: 'Sale', description: 'Up to 30% off.', productIds: [], status: 'active' },
  { id: 'col_eid', handle: 'eid-edit', title: 'Eid Edit', description: 'Festive formals.', productIds: [], status: 'active' },
]

export const seedAttributes = [
  {
    id: 'fabric', key: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, group: 'Material',
    values: [
      { id: 'lawn', label: 'Lawn', sortOrder: 1 }, { id: 'cotton', label: 'Cotton', sortOrder: 2 },
      { id: 'chiffon', label: 'Chiffon', sortOrder: 3 }, { id: 'organza', label: 'Organza', sortOrder: 4 },
      { id: 'silk', label: 'Silk', sortOrder: 5 }, { id: 'khaddar', label: 'Khaddar', sortOrder: 6 },
    ],
  },
  {
    id: 'piece', key: 'piece', label: 'Pieces', type: 'enum', display: 'buttons', filterable: true, group: 'Set',
    values: [
      { id: '1', label: '1-Piece', sortOrder: 1 }, { id: '2', label: '2-Piece', sortOrder: 2 },
      { id: '3', label: '3-Piece', sortOrder: 3 },
    ],
  },
  {
    id: 'occasion', key: 'occasion', label: 'Occasion', type: 'enum', display: 'checkbox', filterable: true, group: 'Style',
    values: [
      { id: 'casual', label: 'Casual', sortOrder: 1 }, { id: 'formal', label: 'Formal', sortOrder: 2 },
      { id: 'bridal', label: 'Bridal', sortOrder: 3 }, { id: 'festive', label: 'Festive', sortOrder: 4 },
    ],
  },
  {
    id: 'material', key: 'material', label: 'Material', type: 'enum', display: 'checkbox', filterable: true,
    values: [
      { id: 'leather', label: 'Leather', sortOrder: 1 }, { id: 'suede', label: 'Suede', sortOrder: 2 },
      { id: 'fabric', label: 'Fabric', sortOrder: 3 }, { id: 'metal', label: 'Metal', sortOrder: 4 },
    ],
  },
]

// ------------------------------------------------------------------ sizes
export const seedSizeSystems = [
  { id: 'sys_alpha', name: 'Alpha (XS–XL)', values: ['XS', 'S', 'M', 'L', 'XL'].map((l, i) => ({ id: l.toLowerCase(), label: l, sortOrder: i })) },
  { id: 'sys_menkurta', name: "Men's Kurta", values: ['S', 'M', 'L', 'XL', 'XXL'].map((l, i) => ({ id: l.toLowerCase(), label: l, sortOrder: i })) },
  { id: 'sys_eu', name: 'EU Footwear', values: ['36', '37', '38', '39', '40', '41'].map((l, i) => ({ id: `eu${l}`, label: l, sortOrder: i })) },
  { id: 'sys_kids', name: 'Kids Age', values: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'].map((l, i) => ({ id: l, label: l, sortOrder: i })) },
]

export const seedSizeCharts = [
  {
    id: 'chart_alpha', title: 'Standard fit (Alpha)', unit: 'in',
    notes: 'Measured flat, in inches.',
    tables: [{
      id: 'shirt', title: 'Shirt', columns: ['XS', 'S', 'M', 'L', 'XL'],
      rows: [
        { label: 'Chest', values: [34, 36, 38, 40, 42] },
        { label: 'Length', values: [42, 43, 44, 45, 46] },
        { label: 'Shoulder', values: [14, 14.5, 15, 15.5, 16] },
      ],
    }],
  },
  {
    id: 'chart_bridal', title: 'Bridal — custom & standard', unit: 'in',
    notes: 'For made-to-order, submit custom measurements at checkout.',
    tables: [{
      id: 'shirt', title: 'Shirt', columns: ['XS', 'S', 'M', 'L', 'XL'],
      rows: [{ label: 'Chest', values: [34, 36, 38, 40, 42] }, { label: 'Waist', values: [28, 30, 32, 34, 36] }],
    }],
  },
]

export const seedFormSchemas = [
  {
    id: 'form_custom_size', title: 'Custom measurements',
    fields: [
      { key: 'chest', label: 'Chest', type: 'number', required: true, unit: 'in', min: 20, max: 60 },
      { key: 'waist', label: 'Waist', type: 'number', required: true, unit: 'in', min: 18, max: 60 },
      { key: 'shoulder', label: 'Shoulder', type: 'number', required: true, unit: 'in', min: 10, max: 24 },
      { key: 'length', label: 'Length', type: 'number', required: true, unit: 'in', min: 30, max: 70 },
    ],
    allowNotes: true,
  },
  {
    id: 'form_checkout_address', title: 'Checkout address',
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, pattern: '^0\\d{3}-?\\d{7}$' },
      { key: 'city', label: 'City', type: 'select', required: true, options: [{ value: 'karachi', label: 'Karachi' }, { value: 'lahore', label: 'Lahore' }, { value: 'islamabad', label: 'Islamabad' }] },
      { key: 'address', label: 'Address', type: 'textarea', required: true },
      { key: 'landmark', label: 'Landmark', type: 'text', required: false },
      { key: 'email', label: 'Email', type: 'email', required: false },
    ],
    allowNotes: true,
  },
]

// --------------------------------------------------------------- products
export const seedProducts = [
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
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [
      { id: 'xs', label: 'XS', sortOrder: 0 }, { id: 's', label: 'S', sortOrder: 1 }, { id: 'm', label: 'M', sortOrder: 2 },
      { id: 'l', label: 'L', sortOrder: 3 }, { id: 'xl', label: 'XL', sortOrder: 4 },
    ] }],
    variants: ['xs', 's', 'm', 'l', 'xl'].map((s, i) => ({
      id: `p1-${s}`, sku: `NOR-3PC-${s.toUpperCase()}`, optionValueIds: [s],
      price: money(6990), compareAt: money(8990),
      stock: { status: i === 4 ? 'low_stock' : 'in_stock', quantity: i === 4 ? 3 : 20, maxPerOrder: 10 },
    })),
    media: [img('p1-1', 'Noor 3-piece, front'), img('p1-2', 'Noor 3-piece, detail', 'detail'), img('p1-3', 'Noor 3-piece, back')],
    sizeChartId: 'chart_alpha', badges: ['sale'],
  },
  {
    id: 'p2', handle: 'ayla-printed-2pc', status: 'active', publishedAt: '2026-08-10T00:00:00Z',
    kind: 'stitched', title: 'Ayla Printed 2-Piece', subtitle: 'Shirt & trouser',
    primaryCategoryId: 'cat_stitched', categoryIds: ['cat_stitched', 'cat_women'], collectionIds: [],
    descriptionMd: 'Digital printed lawn shirt with matching trouser.',
    components: [{ id: 'c1', type: 'shirt', label: 'Printed shirt', fabric: 'Lawn' }, { id: 'c2', type: 'trouser', label: 'Trouser', fabric: 'Cambric' }],
    attributes: { fabric: ['lawn'], piece: ['2'], occasion: ['casual'] },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [
      { id: 's', label: 'S', sortOrder: 0 }, { id: 'm', label: 'M', sortOrder: 1 },
    ] }],
    variants: [
      { id: 'p2-s', sku: 'AYL-2PC-S', optionValueIds: ['s'], price: money(4590), stock: { status: 'in_stock', quantity: 12, maxPerOrder: 10 } },
      { id: 'p2-m', sku: 'AYL-2PC-M', optionValueIds: ['m'], price: money(4590), stock: { status: 'low_stock', quantity: 2, maxPerOrder: 10 } },
    ],
    media: [img('p2-1', 'Ayla 2-piece, front')], sizeChartId: 'chart_alpha',
  },
  {
    id: 'p3', handle: 'raaz-unstitched-lawn-3pc', status: 'active', publishedAt: '2026-07-20T00:00:00Z',
    kind: 'unstitched', title: 'Raaz Unstitched Lawn 3-Piece', primaryCategoryId: 'cat_unstitched',
    categoryIds: ['cat_unstitched', 'cat_women'], collectionIds: ['col_new'],
    descriptionMd: 'Unstitched lawn suit — cut piece by piece.',
    components: [
      { id: 'c1', type: 'shirt', label: 'Shirt fabric', fabric: 'Lawn', quantity: '2.5 m' },
      { id: 'c2', type: 'dupatta', label: 'Dupatta', fabric: 'Chiffon', quantity: '2.5 m' },
      { id: 'c3', type: 'trouser', label: 'Trouser fabric', fabric: 'Cambric', quantity: '2.5 m' },
    ],
    attributes: { fabric: ['lawn'], piece: ['3'], occasion: ['casual'] }, options: [],
    variants: [{ id: 'p3-1', sku: 'RAZ-UNS-3PC', optionValueIds: [], price: money(5490), stock: { status: 'in_stock', quantity: 40, maxPerOrder: 10 } }],
    media: [img('p3-1', 'Raaz unstitched, flat lay', 'flat')], badges: ['new'],
  },
  {
    id: 'p4', handle: 'amani-bridal-made-to-order', status: 'active', publishedAt: '2026-06-01T00:00:00Z',
    kind: 'made-to-order', title: 'Amani Bridal Ensemble', subtitle: 'Made to order', primaryCategoryId: 'cat_bridal',
    categoryIds: ['cat_bridal', 'cat_women'], collectionIds: ['col_eid'],
    descriptionMd: 'Hand-embellished bridal shirt with organza dupatta. 6-week lead time.',
    components: [
      { id: 'c1', type: 'shirt', label: 'Hand-embellished shirt', fabric: 'Organza', technique: 'Zardozi' },
      { id: 'c2', type: 'dupatta', label: 'Embellished dupatta', fabric: 'Net' },
      { id: 'c3', type: 'lehnga', label: 'Lehnga', fabric: 'Raw silk' },
    ],
    attributes: { fabric: ['organza', 'silk'], occasion: ['bridal'] },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [
      { id: 'xs', label: 'XS', sortOrder: 0 }, { id: 's', label: 'S', sortOrder: 1 }, { id: 'm', label: 'M', sortOrder: 2 },
      { id: 'l', label: 'L', sortOrder: 3 }, { id: 'xl', label: 'XL', sortOrder: 4 },
      { id: 'custom', label: 'Custom', sortOrder: 5, kind: 'custom' },
    ] }],
    variants: ['xs', 's', 'm', 'l', 'xl'].map((s) => ({
      id: `p4-${s}`, sku: `AMN-BRD-${s.toUpperCase()}`, optionValueIds: [s], price: money(48000),
      stock: { status: 'made_to_order', maxPerOrder: 2 },
    })).concat([{ id: 'p4-custom', sku: 'AMN-BRD-CUSTOM', optionValueIds: ['custom'], price: money(52000), stock: { status: 'made_to_order', maxPerOrder: 1 } }]),
    media: [img('p4-1', 'Amani bridal, front'), img('p4-2', 'Amani bridal, detail', 'detail')],
    sizeChartId: 'chart_bridal', customSizeSchemaId: 'form_custom_size',
    madeToOrder: { leadTime: { minDays: 35, maxDays: 42, label: '5–6 weeks' }, returnable: false, depositPercent: 50 },
    badges: ['made-to-order'],
  },
  {
    id: 'p5a', handle: 'zaara-pret-emerald', styleId: 'style_zaara', status: 'active', publishedAt: '2026-08-15T00:00:00Z',
    kind: 'stitched', title: 'Zaara Luxury Pret', primaryCategoryId: 'cat_stitched', categoryIds: ['cat_stitched', 'cat_women'], collectionIds: ['col_new'],
    descriptionMd: 'Luxury pret 2-piece, available in three colorways.',
    components: [{ id: 'c1', type: 'shirt', label: 'Shirt', fabric: 'Silk' }, { id: 'c2', type: 'trouser', label: 'Trouser', fabric: 'Silk' }],
    attributes: { fabric: ['silk'], piece: ['2'], occasion: ['formal'] },
    colorway: { label: 'Emerald', family: 'green', swatch: { hex: ['#0b6e4f'] } },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [{ id: 's', label: 'S', sortOrder: 0 }, { id: 'm', label: 'M', sortOrder: 1 }] }],
    variants: [
      { id: 'p5a-s', sku: 'ZAA-EMR-S', optionValueIds: ['s'], price: money(15900), stock: { status: 'in_stock', quantity: 10, maxPerOrder: 10 } },
      { id: 'p5a-m', sku: 'ZAA-EMR-M', optionValueIds: ['m'], price: money(15900), stock: { status: 'in_stock', quantity: 10, maxPerOrder: 10 } },
    ],
    media: [img('p5a-1', 'Zaara Emerald, front')],
  },
  {
    id: 'p5b', handle: 'zaara-pret-wine', styleId: 'style_zaara', status: 'active', publishedAt: '2026-08-15T00:00:00Z',
    kind: 'stitched', title: 'Zaara Luxury Pret', primaryCategoryId: 'cat_stitched', categoryIds: ['cat_stitched', 'cat_women'], collectionIds: ['col_new'],
    descriptionMd: 'Luxury pret 2-piece, available in three colorways.',
    components: [{ id: 'c1', type: 'shirt', label: 'Shirt', fabric: 'Silk' }, { id: 'c2', type: 'trouser', label: 'Trouser', fabric: 'Silk' }],
    attributes: { fabric: ['silk'], piece: ['2'], occasion: ['formal'] },
    colorway: { label: 'Wine', family: 'red', swatch: { hex: ['#722f37'] } },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [{ id: 's', label: 'S', sortOrder: 0 }, { id: 'm', label: 'M', sortOrder: 1 }] }],
    variants: [
      { id: 'p5b-s', sku: 'ZAA-WIN-S', optionValueIds: ['s'], price: money(15900), stock: { status: 'in_stock', quantity: 8, maxPerOrder: 10 } },
      { id: 'p5b-m', sku: 'ZAA-WIN-M', optionValueIds: ['m'], price: money(15900), stock: { status: 'sold_out', quantity: 0, maxPerOrder: 10 } },
    ],
    media: [img('p5b-1', 'Zaara Wine, front')],
  },
  {
    id: 'p7', handle: 'sana-khussa', status: 'active', publishedAt: '2026-08-02T00:00:00Z',
    kind: 'footwear', title: 'Sana Embroidered Khussa', primaryCategoryId: 'cat_footwear', categoryIds: ['cat_footwear'], collectionIds: [],
    descriptionMd: 'Hand-embroidered khussa, EU sizing with half sizes.',
    attributes: { material: ['fabric'] },
    options: [
      { id: 'opt_size', name: 'Size', role: 'size', display: 'select', sizeSystemId: 'sys_eu', values: seedSizeSystems[2].values.map((v) => ({ ...v, kind: 'standard' })) },
      { id: 'opt_color', name: 'Color', role: 'color', display: 'swatch', values: [
        { id: 'gold', label: 'Gold', sortOrder: 0, swatch: { hex: ['#c9a13b'] } },
        { id: 'black', label: 'Black', sortOrder: 1, swatch: { hex: ['#161616'] } },
      ] },
    ],
    variants: seedSizeSystems[2].values.flatMap((sz) => ['gold', 'black'].map((c) => ({
      id: `p7-${sz.id}-${c}`, sku: `KHU-${sz.label}-${c.slice(0, 2).toUpperCase()}`, optionValueIds: [sz.id, c],
      price: money(3200), stock: { status: 'in_stock', quantity: 15, maxPerOrder: 10 },
    }))),
    media: [img('p7-1', 'Sana khussa, gold')],
  },
  {
    id: 'p9', handle: 'nadia-embroidered-clutch', status: 'active', publishedAt: '2026-08-05T00:00:00Z',
    kind: 'accessory', title: 'Nadia Embroidered Clutch', primaryCategoryId: 'cat_accessories', categoryIds: ['cat_accessories'], collectionIds: [],
    descriptionMd: 'Hand-embroidered evening clutch, 22 × 12 cm.',
    attributes: { material: ['fabric'] }, options: [],
    variants: [{ id: 'p9-1', sku: 'CLU-NAD-001', optionValueIds: [], price: money(3800), stock: { status: 'in_stock', quantity: 25, maxPerOrder: 10 } }],
    media: [img('p9-1', 'Nadia clutch')],
  },
  {
    id: 'p12', handle: 'iris-printed-3pc', status: 'active', publishedAt: '2026-07-01T00:00:00Z',
    kind: 'stitched', title: 'Iris Printed 3-Piece', primaryCategoryId: 'cat_stitched', categoryIds: ['cat_stitched', 'cat_women'], collectionIds: [],
    descriptionMd: 'Fully sold out — kept live for notify-me demand.',
    components: [{ id: 'c1', type: 'shirt', label: 'Shirt', fabric: 'Lawn' }],
    attributes: { fabric: ['lawn'], piece: ['3'], occasion: ['casual'] },
    options: [{ id: 'opt_size', name: 'Size', role: 'size', display: 'buttons', sizeSystemId: 'sys_alpha', values: [{ id: 'm', label: 'M', sortOrder: 0 }] }],
    variants: [{ id: 'p12-m', sku: 'IRS-3PC-M', optionValueIds: ['m'], price: money(6200), stock: { status: 'sold_out', quantity: 0, maxPerOrder: 10 } }],
    media: [img('p12-1', 'Iris printed 3-piece')],
  },
]

// ------------------------------------------------------------------ misc
export const seedPromos = [
  { id: 'promo1', code: 'EID25', type: 'percent', value: 25, minSpend: money(5000), usageLimit: 500, usageCount: 128, status: 'active' },
  { id: 'promo2', code: 'FREESHIP', type: 'free_shipping', value: 0, usageCount: 340, status: 'active' },
  { id: 'promo3', code: 'WELCOME10', type: 'percent', value: 10, usageLimit: 1000, usageCount: 1000, status: 'expired' },
]

export const seedOrders = [
  {
    id: 'o1', orderNo: 'SF-10231', status: 'pending', createdAt: '2026-09-21T09:12:00Z',
    customer: { name: 'Amna Raza', phone: '0301-2345678', email: 'amna@example.com' },
    shippingAddress: { address: 'House 12, Street 4, DHA Phase 5', city: 'Karachi', landmark: 'Near Sunset Mall' },
    lines: [{ productId: 'p1', variantId: 'p1-m', title: 'Noor Embroidered Lawn 3-Piece', variantLabel: 'M', sku: 'NOR-3PC-M', qty: 1, price: money(6990) }],
    subtotal: money(6990), shippingFee: money(250), total: money(7240), paymentMethod: 'cod',
  },
  {
    id: 'o2', orderNo: 'SF-10230', status: 'confirmed', createdAt: '2026-09-20T15:40:00Z',
    customer: { name: 'Bilal Ahmed', phone: '0333-1122334' },
    shippingAddress: { address: 'Flat 3B, Gulberg III', city: 'Lahore' },
    lines: [{ productId: 'p4', variantId: 'p4-custom', title: 'Amani Bridal Ensemble', variantLabel: 'Custom', sku: 'AMN-BRD-CUSTOM', qty: 1, price: money(52000), customization: { chest: 38, waist: 32, shoulder: 15, length: 56 } }],
    promoCode: 'EID25', subtotal: money(52000), discount: money(13000), shippingFee: money(0), total: money(39000), paymentMethod: 'bank_transfer', invoiceNo: 'INV-2026-0142',
  },
  {
    id: 'o3', orderNo: 'SF-10229', status: 'dispatched', createdAt: '2026-09-19T11:05:00Z',
    customer: { name: 'Sara Khan', phone: '0345-9988776' },
    shippingAddress: { address: 'E-11/2', city: 'Islamabad' },
    lines: [
      { productId: 'p2', variantId: 'p2-s', title: 'Ayla Printed 2-Piece', variantLabel: 'S', sku: 'AYL-2PC-S', qty: 2, price: money(4590) },
      { productId: 'p9', variantId: 'p9-1', title: 'Nadia Embroidered Clutch', variantLabel: '—', sku: 'CLU-NAD-001', qty: 1, price: money(3800) },
    ],
    subtotal: money(12980), shippingFee: money(0), total: money(12980), paymentMethod: 'cod', invoiceNo: 'INV-2026-0141',
  },
  {
    id: 'o4', orderNo: 'SF-10228', status: 'delivered', createdAt: '2026-09-14T08:00:00Z',
    customer: { name: 'Hina Malik', phone: '0312-4455667' },
    shippingAddress: { address: 'Model Town', city: 'Lahore' },
    lines: [{ productId: 'p5a', variantId: 'p5a-m', title: 'Zaara Luxury Pret — Emerald', variantLabel: 'M', sku: 'ZAA-EMR-M', qty: 1, price: money(15900) }],
    subtotal: money(15900), shippingFee: money(250), total: money(16150), paymentMethod: 'card', invoiceNo: 'INV-2026-0139',
  },
  {
    id: 'o5', orderNo: 'SF-10227', status: 'cancelled', createdAt: '2026-09-12T18:22:00Z',
    customer: { name: 'Omar Farooq', phone: '0300-1234567' },
    shippingAddress: { address: 'North Nazimabad', city: 'Karachi' },
    lines: [{ productId: 'p3', variantId: 'p3-1', title: 'Raaz Unstitched Lawn 3-Piece', variantLabel: '—', sku: 'RAZ-UNS-3PC', qty: 1, price: money(5490) }],
    subtotal: money(5490), shippingFee: money(250), total: money(5740), paymentMethod: 'cod',
  },
]

export const seedReviews = [
  { id: 'r1', productId: 'p1', author: 'Zainab S.', rating: 5, title: 'True to size, gorgeous fabric', body: 'Ordered a medium and it fit perfectly. Embroidery is even better in person.', fit: 'true_to_size', photos: [], status: 'approved', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'r2', productId: 'p1', author: 'Fatima R.', rating: 4, body: 'Runs slightly large, order one size down.', fit: 'runs_large', photos: [], status: 'pending', createdAt: '2026-09-18T00:00:00Z' },
  { id: 'r3', productId: 'p4', author: 'Mehak A.', rating: 5, title: 'Worth the wait', body: 'The lead time was exactly as promised and the finishing is stunning.', fit: 'true_to_size', photos: [], status: 'approved', createdAt: '2026-08-20T00:00:00Z' },
]

export const seedMenus = [
  {
    id: 'menu_header', handle: 'header',
    items: [
      { id: 'm1', label: 'Unstitched', href: '/c/women/unstitched', children: [] },
      { id: 'm2', label: 'Stitched', href: '/c/women/stitched', children: [] },
      { id: 'm3', label: 'Bridal', href: '/c/women/bridal', children: [] },
      { id: 'm4', label: 'Footwear', href: '/c/footwear', children: [] },
      { id: 'm5', label: 'Accessories', href: '/c/accessories', children: [] },
      { id: 'm6', label: 'Sale', href: '/collections/sale', children: [] },
    ],
  },
  {
    id: 'menu_footer', handle: 'footer',
    items: [
      { id: 'f1', label: 'Track order', href: '/track-order', children: [] },
      { id: 'f2', label: 'Returns', href: '/pages/returns', children: [] },
      { id: 'f3', label: 'Shipping', href: '/pages/shipping', children: [] },
      { id: 'f4', label: 'Contact', href: '/pages/contact', children: [] },
    ],
  },
]

export const seedPages = [
  { id: 'pg1', slug: 'contact', title: 'Contact us', status: 'active', bodyMd: 'Reach us via WhatsApp or email, 10am–7pm, seven days a week.' },
  { id: 'pg2', slug: 'returns', title: 'Returns & Exchanges', status: 'active', bodyMd: 'Unworn, unwashed items can be returned within 7 days of delivery. Made-to-order and custom-size pieces are final sale.' },
  { id: 'pg3', slug: 'shipping', title: 'Shipping Information', status: 'active', bodyMd: 'Standard delivery takes 3–5 business days within Pakistan. Free shipping on orders above Rs. 5,000.' },
]

export const seedStoreConfig = {
  brand: { name: 'Noor & Co.', logo: { light: '' }, tagline: 'Contemporary Pakistani fashion' },
  theme: {
    colors: {
      bg: '#FBF9F6', surface: '#FFFFFF', fg: '#231F1C', muted: '#8A8078', line: '#E7E0D8',
      accent: '#7A2E3A', onAccent: '#FFFFFF', sale: '#B23A3A', success: '#3F7D58', warning: '#B8863B',
      danger: '#B23A3A', focus: '#2C3E8C',
    },
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    radius: { control: 'soft', card: 'soft', media: 'soft' },
    density: 'comfortable',
    mediaRatio: '3/4',
    header: { layout: 'center', sticky: true },
  },
  locale: { default: 'en-PK', supported: ['en-PK'], currency: 'PKR', direction: 'ltr' },
  priceDisplay: { showDecimals: false, rounding: 'nearest' },
  notices: [{ id: 'n1', text: 'Free shipping on orders above Rs. 5,000', severity: 'promo' }],
  contact: { whatsapp: '92300000000', phone: '0300-0000000', email: 'hello@noor.co', address: 'Karachi, Pakistan', socials: [] },
  shipping: {
    zones: [
      { id: 'z1', name: 'Major cities', cities: ['Karachi', 'Lahore', 'Islamabad'], methods: [{ id: 'std', label: 'Standard', fee: money(250), freeAbove: money(5000), etaDays: [3, 5] }] },
      { id: 'z2', name: 'Rest of Pakistan', cities: ['Other'], methods: [{ id: 'std2', label: 'Standard', fee: money(350), freeAbove: money(7000), etaDays: [5, 8] }] },
    ],
    codLimit: money(100000),
  },
  payments: [
    { id: 'cod', type: 'cod', label: 'Cash on Delivery', enabled: true },
    { id: 'card', type: 'card', label: 'Credit / Debit Card', enabled: true },
    { id: 'bank', type: 'bank_transfer', label: 'Bank Transfer', enabled: true },
  ],
  checkout: { guest: true, fields: seedFormSchemas[1] },
  features: { wishlist: true, reviews: true, notifyMe: true, customSizing: true, findMySize: false, compare: false, multiCurrency: false },
  policies: { returns: 'returns', shipping: 'shipping' },
}

// -------------------------------------------------------- page templates
function section(id, type, settings, opts = {}) {
  const blockOrder = (opts.blocks || []).map((b) => b.id)
  const blocks = Object.fromEntries((opts.blocks || []).map((b) => [b.id, b]))
  return { id, type, settings, blocks, blockOrder, disabled: opts.disabled || false }
}
function tmpl(id, type, sections) {
  return { id, type, sections: Object.fromEntries(sections.map((s) => [s.id, s])), order: sections.map((s) => s.id) }
}

export const seedTemplates = [
  tmpl('tpl_home', 'home', [
    section('sec_h1', 'hero', { heading: 'Festive Edit, 2026', subheading: 'Hand-embroidered lawn & luxury pret', ctaLabel: 'Shop now', ctaHref: '/collections/festive', mediaUrl: '' }),
    section('sec_h2', 'announcement_bar', { text: 'Free shipping on orders above Rs. 5,000', href: '' }),
    section('sec_h3', 'featured_collection', { collectionId: 'col1', heading: 'New arrivals', limit: 8 }),
    section('sec_h4', 'image_with_text', { heading: 'Made to order, made for you', body: 'Custom sizing on every bridal piece.', mediaUrl: '', layout: 'image_left' }),
    section('sec_h5', 'testimonials', { heading: 'What customers say' }, {
      blocks: [
        { id: 'blk_h5a', type: 'quote', settings: { quote: 'True to size, gorgeous fabric.', author: 'Zainab S.' } },
        { id: 'blk_h5b', type: 'quote', settings: { quote: 'Worth the wait, stunning finishing.', author: 'Mehak A.' } },
      ],
    }),
    section('sec_h6', 'newsletter', { heading: 'Join the list', body: 'Early access to drops and sales.' }),
  ]),
  tmpl('tpl_category', 'category', [
    section('sec_c1', 'banner', { heading: '{{category.name}}', mediaUrl: '' }),
    section('sec_c2', 'filter_bar', { showSort: true, showSizeFilter: true, showPriceFilter: true }),
    section('sec_c3', 'product_grid', { columns: 4, perPage: 24 }),
  ]),
  tmpl('tpl_collection', 'collection', [
    section('sec_col1', 'banner', { heading: '{{collection.name}}', mediaUrl: '' }),
    section('sec_col2', 'rich_text', { body: '{{collection.description}}' }),
    section('sec_col3', 'product_grid', { columns: 4, perPage: 24 }),
  ]),
  tmpl('tpl_product', 'product', [
    section('sec_p1', 'media_gallery', { layout: 'thumbnails_left', zoom: true }),
    section('sec_p2', 'buy_box', { showSku: true, showStock: true, showSizeGuide: true }),
    section('sec_p3', 'rich_text_tabs', {}, {
      blocks: [
        { id: 'blk_p3a', type: 'tab', settings: { label: 'Description', body: '{{product.description}}' } },
        { id: 'blk_p3b', type: 'tab', settings: { label: 'Fabric & care', body: '{{product.care}}' } },
        { id: 'blk_p3c', type: 'tab', settings: { label: 'Shipping & returns', body: '{{policies.shipping}}' } },
      ],
    }),
    section('sec_p4', 'reviews_list', { perPage: 10 }),
    section('sec_p5', 'related_products', { heading: 'You may also like', limit: 4 }),
  ]),
  tmpl('tpl_page', 'page', [
    section('sec_pg1', 'rich_text', { body: '{{page.bodyMd}}' }),
  ]),
  tmpl('tpl_cart', 'cart', [
    section('sec_ca1', 'cart_lines', { showPromoField: true }),
    section('sec_ca2', 'cart_summary', { showShippingEstimate: true }),
  ]),
  tmpl('tpl_search', 'search', [
    section('sec_s1', 'search_bar', { placeholder: 'Search products…' }),
    section('sec_s2', 'product_grid', { columns: 4, perPage: 24, emptyMessage: 'No results found.' }),
  ]),
]
// ------------------------------------------------------- product images
// Seed products start with an admin-style gallery built from their media (first image = main).
for (const p of seedProducts) {
  p.images = p.media.filter((m) => m.type === 'image').map((m, i) => ({
    id: `${m.id}-img`, url: m.url, alt: m.alt, sortOrder: i, isPrimary: i === 0, width: m.width, height: m.height,
  }))
}

// -------------------------------------------------------- site settings
export const seedSiteSettings = {
  siteTitle: seedStoreConfig.brand.name,
  logoUrl: '',
  faviconUrl: '',
  heroSlides: [
    { id: 'slide_1', imageUrl: 'https://picsum.photos/seed/hero-1/1600/700', heading: 'Festive Edit, 2026', subheading: 'Hand-embroidered lawn & luxury pret', buttonText: 'Shop now', buttonLink: '/shop', sortOrder: 0 },
    { id: 'slide_2', imageUrl: 'https://picsum.photos/seed/hero-2/1600/700', heading: 'Made to order, made for you', subheading: 'Custom sizing on every bridal piece', buttonText: 'Explore bridal', buttonLink: '/shop', sortOrder: 1 },
  ],
}
