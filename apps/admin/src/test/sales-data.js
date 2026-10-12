// Orders as the API answers, for the tests of the order screens.
const uuid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
export const oid = { order: uuid(500), line1: uuid(501), line2: uuid(502), customer: uuid(600), city: uuid(700), city2: uuid(701), courier: uuid(800), courier2: uuid(801), event: uuid(900) }
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const at = '2026-10-05T10:00:00.000Z'

/** One order as `admin.orders.get` gives it. @param {Record<string, unknown>} [over] */
export const orderFixture = (over = {}) => ({
  id: oid.order,
  orderNumber: 'RB-10458',
  status: 'pending_confirmation',
  channel: 'storefront',
  version: 3,
  placedAt: at,
  statusChangedAt: at,
  customer: { id: oid.customer, name: 'Ayesha Khan', phone: '0300 1234567', email: 'ayesha@example.com', ordersCount: 3, deliveredCount: 2, refusedCount: 0, noCod: false, vip: false },
  riskMarkers: [],
  shippingAddress: { cityId: oid.city, city: 'Lahore', address: 'House 12, Street 4, DHA Phase 5', landmark: 'near the park' },
  shipping: { label: 'Standard', fee: money(25000), etaMinDays: 3, etaMaxDays: 5 },
  lines: [
    { id: oid.line1, productId: uuid(1), variantId: uuid(2), title: 'Lawn 3-Piece', variantLabel: 'M', sku: 'LWN-3P-M', kind: 'stitched', quantity: 1, returnedQuantity: 0, unitPrice: money(699000), lineSubtotal: money(699000), lineDiscount: money(0), deposit: money(0), stockTracked: true },
    { id: oid.line2, productId: uuid(3), variantId: uuid(4), title: 'Silk Dupatta', variantLabel: 'One size', sku: 'SLK-DUP', kind: 'unstitched', quantity: 2, returnedQuantity: 0, unitPrice: money(150000), lineSubtotal: money(300000), lineDiscount: money(0), deposit: money(0), stockTracked: true },
  ],
  subtotal: money(999000),
  discount: money(0),
  shippingFee: money(25000),
  total: money(1024000),
  depositDue: money(0),
  paid: money(0),
  refunded: money(0),
  dueOnDelivery: money(1024000),
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  payments: [],
  confirmationAttempts: 0,
  events: [{ id: oid.event, type: 'placed', toStatus: 'pending_confirmation', actorType: 'storefront', createdAt: at }],
  allowedActions: ['confirm', 'edit_address', 'edit_items', 'cancel'],
  customerLink: 'http://localhost:5174/orders/abc',
  ...over,
})

/** One row of the list. @param {Record<string, unknown>} [over] */
export const rowFixture = (over = {}) => ({
  id: oid.order,
  orderNumber: 'RB-10458',
  status: 'pending_confirmation',
  placedAt: at,
  statusChangedAt: at,
  customerName: 'Ayesha Khan',
  customerPhone: '0300 1234567',
  city: 'Lahore',
  itemCount: 2,
  firstItemTitle: 'Lawn 3-Piece',
  total: money(1024000),
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  riskMarkers: [],
  ...over,
})

export const lookupsAnswer = () => ({
  couriers: [
    { id: oid.courier, name: 'TCS', trackingRequired: true },
    { id: oid.courier2, name: 'Own rider', trackingRequired: false },
  ],
  cities: [
    { id: oid.city, name: 'Lahore' },
    { id: oid.city2, name: 'Karachi' },
  ],
})

export const countsAnswer = (/** @type {Record<string, number>} */ over = {}) => ({ pending: 0, pending_confirmation: 4, confirmed: 2, dispatched: 1, delivered: 9, cancelled: 1, returned: 1, ...over })

/** The invoice data of an order. @param {Record<string, unknown>} [over] */
export const invoiceFixture = (over = {}) => ({
  store: { name: 'Rubaya', phone: '0300 0000000', email: 'hello@rubaya.pk' },
  invoiceNumber: 'INV-2026-000001',
  orderNumber: 'RB-10458',
  placedAt: at,
  customer: { name: 'Ayesha Khan', phone: '0300 1234567' },
  shippingAddress: { city: 'Lahore', address: 'House 12, Street 4, DHA Phase 5' },
  lines: [{ title: 'Lawn 3-Piece', variantLabel: 'M', sku: 'LWN-3P-M', quantity: 1, unitPrice: money(699000), lineTotal: money(699000) }],
  totals: { subtotal: money(699000), discount: money(0), shippingFee: money(25000), total: money(724000), depositDue: money(0) },
  paid: money(0),
  amountToCollect: money(724000),
  paymentMethod: 'cod',
  ...over,
})

const sid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
export const pid = { product: sid(1000), variantM: sid(1001), variantL: sid(1002), optionSize: sid(1003), valM: sid(1004), valL: sid(1005), schema: sid(1006), method: sid(1007), method2: sid(1008) }

/** The product the picker opens: sizes M and L. @param {Record<string, unknown>} [over] */
export const pickProductFixture = (over = {}) => ({
  id: pid.product,
  handle: 'lawn-suit',
  status: 'active',
  kind: 'stitched',
  title: 'Lawn Suit',
  primaryCategoryId: sid(2000),
  categoryIds: [],
  attributes: [],
  media: [],
  options: [{ id: pid.optionSize, name: 'Size', role: 'size', display: 'buttons', values: [{ id: pid.valM, key: 'm', label: 'M' }, { id: pid.valL, key: 'l', label: 'L' }] }],
  variants: [
    { id: pid.variantM, key: 'm', sku: 'LS-M', optionValueKeys: ['m'], price: money(699000), stockMode: 'counted', maxPerOrder: 10, enabled: true, stockStatus: 'in_stock', hasOrders: false },
    { id: pid.variantL, key: 'l', sku: 'LS-L', optionValueKeys: ['l'], price: money(699000), stockMode: 'counted', maxPerOrder: 10, enabled: true, stockStatus: 'sold_out', hasOrders: false },
  ],
  badges: [],
  version: 2,
  createdAt: at,
  updatedAt: at,
  siblings: [],
  collections: [],
  checks: [],
  ...over,
})

export const productRowFixture = () => ({
  id: pid.product, handle: 'lawn-suit', title: 'Lawn Suit', status: 'active', kind: 'stitched', primaryCategory: { id: sid(2000), name: 'Women' }, variantCount: 2, stockStatus: 'in_stock', priceFrom: money(699000), updatedAt: at, hasIssues: false,
})

/** What `admin.orders.quote` answers for one Lawn Suit in M. @param {Record<string, unknown>} [over] */
export const quoteFixture = (over = {}) => ({
  lines: [
    { id: sid(1100), productId: pid.product, variantId: pid.variantM, handle: 'lawn-suit', title: 'Lawn Suit', variantLabel: 'M', kind: 'stitched', quantity: 1, unitPrice: money(699000), lineSubtotal: money(699000), lineDiscount: money(0), maxPerOrder: 10, issues: [] },
  ],
  count: 1,
  subtotal: money(699000),
  discount: money(0),
  shipping: { methodId: pid.method, label: 'Standard', fee: money(25000), etaMinDays: 3, etaMaxDays: 5 },
  total: money(724000),
  shippingOptions: [
    { methodId: pid.method, label: 'Standard', fee: money(25000), etaMinDays: 3, etaMaxDays: 5, codAllowed: true },
    { methodId: pid.method2, label: 'Express', fee: money(45000), etaMinDays: 1, etaMaxDays: 2, codAllowed: true },
  ],
  paymentOptions: [{ method: 'cod', label: 'Cash on delivery', allowed: true }],
  messages: [],
  hasBlockingIssues: false,
  ...over,
})

/** A customer as `admin.customers.get` gives it. @param {Record<string, unknown>} [over] */
export const customerFixture = (over = {}) => ({
  id: oid.customer,
  name: 'Ayesha Khan',
  phone: '+923001234567',
  email: 'ayesha@example.com',
  city: 'Lahore',
  ordersCount: 3,
  deliveredCount: 2,
  refusedCount: 0,
  cancelledCount: 1,
  spent: money(2048000),
  averageOrder: money(1024000),
  lastOrderAt: at,
  firstOrderAt: '2026-08-01T10:00:00.000Z',
  noCod: false,
  vip: false,
  marketingConsent: false,
  addresses: [{ city: 'Lahore', address: 'House 12, Street 4, DHA Phase 5', lastUsedAt: at }],
  notes: [],
  version: 4,
  ...over,
})

const rowKeys = ['id', 'name', 'phone', 'city', 'ordersCount', 'deliveredCount', 'refusedCount', 'spent', 'lastOrderAt', 'noCod', 'vip', 'marketingConsent']
/** @param {Record<string, unknown>} [over] */
export const customerRowFixture = (over = {}) => ({ ...Object.fromEntries(Object.entries(customerFixture()).filter(([k]) => rowKeys.includes(k))), ...over })
