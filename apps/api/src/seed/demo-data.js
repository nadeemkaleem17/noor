// Demo catalog for local work, CI and staging: a small, realistic fashion shop. Prices in rupees (the seed converts to paisa).
// The structure follows the old admin's fixtures (categories, attributes, sizes) in the new schema; products are new.

export const demoCategories = [
  { handle: 'women', name: 'Women', description: 'Stitched, unstitched and bridal pieces for every day and every occasion.', filters: ['fabric', 'piece', 'occasion'] },
  { handle: 'unstitched', name: 'Unstitched', parent: 'women', description: 'Lawn, khaddar and chiffon fabric sets to have stitched your way.', filters: ['fabric', 'piece'] },
  { handle: 'stitched', name: 'Stitched', parent: 'women', description: 'Ready to wear kurtas, co-ord sets and formals, in standard sizes.', filters: ['fabric', 'piece', 'occasion'] },
  { handle: 'bridal', name: 'Bridal & Formals', parent: 'women', description: 'Bridal lehngas and formal gowns, made to your measurements.', filters: ['fabric', 'occasion'] },
  { handle: 'footwear', name: 'Footwear', description: 'Khussas, sandals and heels.', filters: ['material'] },
  { handle: 'accessories', name: 'Accessories', description: 'Clutches, bags and jewellery to finish the look.', filters: ['material'] },
  { handle: 'men', name: 'Men', description: 'Kurtas and waistcoats for men.', filters: ['fabric'] },
  { handle: 'kids', name: 'Kids', description: 'Easy, breathable pieces for children.', filters: ['fabric'] },
]

export const demoAttributes = [
  { code: 'fabric', label: 'Fabric', group: 'Material', display: 'checkbox', values: ['lawn:Lawn', 'cotton:Cotton', 'chiffon:Chiffon', 'organza:Organza', 'silk:Silk', 'khaddar:Khaddar'] },
  { code: 'piece', label: 'Pieces', group: 'Set', display: 'buttons', values: ['1:1-Piece', '2:2-Piece', '3:3-Piece'] },
  { code: 'occasion', label: 'Occasion', group: 'Style', display: 'checkbox', values: ['casual:Casual', 'formal:Formal', 'bridal:Bridal', 'festive:Festive'] },
  { code: 'material', label: 'Material', group: undefined, display: 'checkbox', values: ['leather:Leather', 'suede:Suede', 'fabric:Fabric', 'metal:Metal'] },
]

export const demoSizeSystems = [
  { name: "Men's kurta", labels: ['S', 'M', 'L', 'XL', 'XXL'] },
  { name: 'Kids age', labels: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'] },
]

export const demoCharts = [
  {
    title: 'Standard fit (women)',
    system: "Women's stitched",
    unit: 'in',
    notes: 'Measured flat, in inches.',
    tables: [{ id: 'shirt', title: 'Shirt', columns: ['XS', 'S', 'M', 'L', 'XL'], rows: [{ label: 'Chest', values: [34, 36, 38, 40, 42] }, { label: 'Length', values: [42, 43, 44, 45, 46] }, { label: 'Shoulder', values: [14, 14.5, 15, 15.5, 16] }] }],
  },
]

export const demoForms = [
  { title: 'Bridal measurements', allowNotes: true, fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true, unit: 'in', min: 20, max: 60 }, { key: 'waist', label: 'Waist', type: 'number', required: true, unit: 'in', min: 20, max: 60 }, { key: 'hip', label: 'Hip', type: 'number', required: true, unit: 'in', min: 20, max: 70 }, { key: 'length', label: 'Dress length', type: 'number', required: false, unit: 'in', min: 30, max: 70 }] },
]

/**
 * kind 'stitched' and 'footwear' have sizes (`sizes`: label -> stock; the system comes from `system`); 'unstitched' and the rest have one variant
 * with `stock` (null: made to order). `style` + `colorway` make colourway siblings.
 * @typedef {{ title: string, cat: string, kind: string, price: number, compare?: number, fabric?: string, piece?: string, occasion?: string, material?: string,
 *   color: string, hex: string, style?: string, colorway?: string, sizes?: Record<string, number>, system?: string, stock?: number | null, sales?: number, rank?: number,
 *   badges?: string[], blurb: string }} DemoProduct
 */

/** @type {DemoProduct[]} */
export const demoProducts = [
  { title: 'Embroidered Lawn 3-Piece', cat: 'unstitched', kind: 'unstitched', price: 6990, compare: 8490, fabric: 'lawn', piece: '3', occasion: 'casual', color: 'green', hex: '#1F6F6B', style: 'embroidered-lawn', colorway: 'Teal', stock: 24, sales: 64, rank: 3, blurb: 'Printed lawn shirt with embroidered neckline, dyed trouser and chiffon dupatta.' },
  { title: 'Embroidered Lawn 3-Piece Maroon', cat: 'unstitched', kind: 'unstitched', price: 6990, compare: 8490, fabric: 'lawn', piece: '3', occasion: 'casual', color: 'red', hex: '#7A1F2B', style: 'embroidered-lawn', colorway: 'Maroon', stock: 12, sales: 41, blurb: 'Printed lawn shirt with embroidered neckline, dyed trouser and chiffon dupatta.' },
  { title: 'Printed Lawn 2-Piece', cat: 'unstitched', kind: 'unstitched', price: 3990, fabric: 'lawn', piece: '2', occasion: 'casual', color: 'pink', hex: '#E58AA8', stock: 40, sales: 88, blurb: 'Digital print on soft lawn, with a plain trouser.' },
  { title: 'Khaddar Winter 3-Piece', cat: 'unstitched', kind: 'unstitched', price: 5490, compare: 6490, fabric: 'khaddar', piece: '3', occasion: 'casual', color: 'brown', hex: '#8B5A2B', stock: 0, sales: 33, blurb: 'Warm khaddar shirt and trouser with a wool-blend shawl.' },
  { title: 'Organza Embroidered Festive 3-Piece', cat: 'unstitched', kind: 'unstitched', price: 14990, fabric: 'organza', piece: '3', occasion: 'festive', color: 'gold', hex: '#C9A227', stock: 8, sales: 19, rank: 4, badges: ['limited'], blurb: 'Heavily embroidered organza shirt with silk trouser and net dupatta.' },
  { title: 'Chiffon Dupatta Set', cat: 'unstitched', kind: 'unstitched', price: 2990, fabric: 'chiffon', piece: '1', occasion: 'formal', color: 'purple', hex: '#7D3C98', stock: 30, sales: 12, blurb: 'Two-tone chiffon dupatta with a lace border.' },

  { title: 'Cotton Kurta', cat: 'stitched', kind: 'stitched', price: 3490, fabric: 'cotton', piece: '1', occasion: 'casual', color: 'white', hex: '#F4F1EA', sizes: { XS: 4, S: 10, M: 12, L: 8, XL: 3 }, system: "Women's stitched", sales: 70, rank: 2, blurb: 'A straight-cut kurta in breathable cotton.' },
  { title: 'Lawn Kurta Block Print', cat: 'stitched', kind: 'stitched', price: 4290, compare: 4990, fabric: 'lawn', piece: '1', occasion: 'casual', color: 'blue', hex: '#2F5DA8', sizes: { S: 5, M: 0, L: 6, XL: 2 }, system: "Women's stitched", sales: 45, blurb: 'Hand block print on lawn, relaxed fit.' },
  { title: 'Silk Formal 2-Piece', cat: 'stitched', kind: 'stitched', price: 12990, fabric: 'silk', piece: '2', occasion: 'formal', color: 'black', hex: '#111111', sizes: { S: 3, M: 4, L: 3 }, system: "Women's stitched", sales: 22, badges: ['bestseller'], blurb: 'Tailored silk shirt and trouser for evenings.' },
  { title: 'Chiffon Festive 3-Piece', cat: 'stitched', kind: 'stitched', price: 17990, compare: 21990, fabric: 'chiffon', piece: '3', occasion: 'festive', color: 'pink', hex: '#D96C8F', sizes: { S: 2, M: 2, L: 1 }, system: "Women's stitched", sales: 15, blurb: 'Ready-to-wear chiffon with sequin work.' },
  { title: 'Cotton Co-ord Set', cat: 'stitched', kind: 'stitched', price: 5490, fabric: 'cotton', piece: '2', occasion: 'casual', color: 'beige', hex: '#D8C3A5', sizes: { XS: 2, S: 6, M: 6, L: 4 }, system: "Women's stitched", sales: 28, blurb: 'Matching top and wide-leg trouser.' },

  { title: 'Bridal Lehnga Ivory', cat: 'bridal', kind: 'made_to_order', price: 185000, fabric: 'silk', occasion: 'bridal', color: 'white', hex: '#F8F4E3', style: 'bridal-lehnga', colorway: 'Ivory', stock: null, rank: 5, blurb: 'Hand-embroidered raw silk lehnga with net dupatta, made to your measurements.' },
  { title: 'Bridal Lehnga Red', cat: 'bridal', kind: 'made_to_order', price: 185000, fabric: 'silk', occasion: 'bridal', color: 'red', hex: '#B3122F', style: 'bridal-lehnga', colorway: 'Red', stock: null, blurb: 'Hand-embroidered raw silk lehnga with net dupatta, made to your measurements.' },
  { title: 'Formal Gown Emerald', cat: 'bridal', kind: 'made_to_order', price: 78000, fabric: 'organza', occasion: 'formal', color: 'green', hex: '#0B6E4F', stock: null, blurb: 'Floor-length organza gown, cut and finished for you.' },

  { title: 'Leather Kolhapuri Sandals', cat: 'footwear', kind: 'footwear', price: 3990, material: 'leather', color: 'brown', hex: '#8B5A2B', sizes: { '37': 4, '38': 6, '39': 6, '40': 3, '41': 0 }, system: 'Footwear EU', sales: 36, blurb: 'Hand-stitched leather sandals.' },
  { title: 'Embroidered Khussa', cat: 'footwear', kind: 'footwear', price: 2990, material: 'fabric', color: 'gold', hex: '#C9A227', sizes: { '36': 2, '37': 5, '38': 5, '39': 4, '40': 2 }, system: 'Footwear EU', sales: 52, rank: 1, blurb: 'Traditional khussa with zari embroidery.' },
  { title: 'Suede Block Heels', cat: 'footwear', kind: 'footwear', price: 5990, compare: 7490, material: 'suede', color: 'black', hex: '#222222', sizes: { '37': 3, '38': 3, '39': 3, '40': 1 }, system: 'Footwear EU', sales: 9, blurb: 'Suede block heels, 7 cm.' },

  { title: 'Embroidered Clutch', cat: 'accessories', kind: 'accessory', price: 2490, material: 'fabric', color: 'gold', hex: '#C9A227', stock: 15, sales: 14, blurb: 'Zari-embroidered evening clutch with a chain strap.' },
  { title: 'Leather Tote', cat: 'accessories', kind: 'accessory', price: 6990, material: 'leather', color: 'brown', hex: '#7B4B2A', stock: 7, sales: 26, blurb: 'Everyday leather tote with an inner zip pocket.' },
  { title: 'Statement Jhumka Earrings', cat: 'accessories', kind: 'accessory', price: 1490, material: 'metal', color: 'gold', hex: '#D4AF37', stock: 50, sales: 31, blurb: 'Gold-plated jhumkas with pearl drops.' },

  { title: 'Cotton Kurta Men White', cat: 'men', kind: 'stitched', price: 3990, fabric: 'cotton', color: 'white', hex: '#F4F1EA', sizes: { S: 5, M: 8, L: 8, XL: 4, XXL: 2 }, system: "Men's kurta", sales: 58, blurb: 'Classic cotton kurta with a mandarin collar.' },
  { title: 'Khaddar Waistcoat', cat: 'men', kind: 'stitched', price: 4990, fabric: 'khaddar', color: 'grey', hex: '#6E6E6E', sizes: { M: 3, L: 4, XL: 3 }, system: "Men's kurta", sales: 17, blurb: 'Structured khaddar waistcoat, fully lined.' },

  { title: 'Kids Cotton Frock', cat: 'kids', kind: 'stitched', price: 2290, fabric: 'cotton', color: 'pink', hex: '#F4A6C0', sizes: { '2-3Y': 4, '4-5Y': 6, '6-7Y': 5, '8-9Y': 2 }, system: 'Kids age', sales: 21, blurb: 'Soft cotton frock with a gathered skirt.' },
  { title: 'Kids Lawn Kurta Set', cat: 'kids', kind: 'stitched', price: 2690, fabric: 'lawn', color: 'blue', hex: '#5DA9E9', sizes: { '4-5Y': 5, '6-7Y': 5, '8-9Y': 3 }, system: 'Kids age', sales: 11, blurb: 'Printed lawn kurta with a matching trouser.' },
]
