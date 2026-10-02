// Storefront checkout → the contract Order the API expects (mock-api OrderInput / admin schemas.js).
// The storefront works in whole rupees; the contract uses Money in minor units (paisa).
const money = (rupees) => ({ amount: Math.round(rupees * 100), currency: 'PKR' })

export class CheckoutError extends Error {}

// Throws CheckoutError when a cart line can't be ordered through the API (e.g. it was added
// from the sample catalog before the API was connected, so it has no real variant).
export function toContractOrder({ customer, items, subtotal, discount, shipping, total, promoCode, paymentMethod }) {
  const stale = items.filter((i) => !i.variantId)
  if (stale.length) {
    throw new CheckoutError(
      `${stale.map((i) => `"${i.name}"`).join(', ')} ${stale.length === 1 ? 'is' : 'are'} no longer available. Remove ${stale.length === 1 ? 'it' : 'them'} from your bag and add ${stale.length === 1 ? 'it' : 'them'} again.`,
    )
  }
  return {
    customer: { name: customer.name, phone: customer.phone },
    shippingAddress: { address: customer.address, city: customer.city },
    lines: items.map((i) => ({
      productId: i.id,
      variantId: i.variantId,
      title: i.name,
      variantLabel: i.size || '—',
      sku: i.sku || i.variantId,
      qty: i.qty,
      price: money(i.price),
      ...(i.image && { mediaUrl: i.image }),
    })),
    ...(promoCode && { promoCode }),
    subtotal: money(subtotal),
    ...(discount > 0 && { discount: money(discount) }),
    shippingFee: money(shipping),
    total: money(total),
    paymentMethod,
  }
}

// API order → the storefront's own order shape (what the confirmation / track pages render).
export function fromContractOrder(order, { items, customer } = {}) {
  const rupees = (m) => (m ? m.amount / 100 : 0)
  return {
    id: order.id,
    orderNo: order.orderNo,
    createdAt: order.createdAt,
    status: order.status,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.shippingAddress.address,
      city: order.shippingAddress.city,
      ...customer,
    },
    items: items || order.lines.map((l) => ({
      id: l.productId, name: l.title, price: rupees(l.price), qty: l.qty,
      size: l.variantLabel && l.variantLabel !== '—' ? l.variantLabel : null,
      ...(l.mediaUrl && { image: l.mediaUrl }),
    })),
    subtotal: rupees(order.subtotal),
    discount: rupees(order.discount),
    shipping: rupees(order.shippingFee),
    total: rupees(order.total),
    promoCode: order.promoCode || null,
    paymentMethod: order.paymentMethod,
    dispatch: order.dispatch || null,
    invoice: order.invoiceNo ? { invoiceNo: order.invoiceNo } : null,
    history: order.history || [],
  }
}
