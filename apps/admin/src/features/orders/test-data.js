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
