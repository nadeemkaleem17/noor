import { createContext, useContext, useEffect, useRef } from 'react'
import { usePersistentState, isObj, isArrayOf, isStr, isNum } from '../hooks/usePersistentState'
import { newId } from '../utils/format'

const OrdersContext = createContext(null)

const isOrder = (o) =>
  isObj(o) && isStr(o.id) && isStr(o.orderNo) && isStr(o.status) &&
  isObj(o.customer) && Array.isArray(o.items) && isNum(o.total)

// Order/invoice numbers continue from the highest one already present, so they stay
// unique after a refresh instead of restarting at the module-level seed.
function highest(orders, pick, floor) {
  return orders.reduce((max, o) => {
    const n = parseInt(String(pick(o) ?? '').replace(/\D/g, ''), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, floor)
}

const SEED_ORDERS = [
  {
    id: 'o1', orderNo: '#1039', createdAt: '2026-09-10T10:00:00Z',
    customer: { name: 'Sara M.', phone: '0300-1234567', address: 'House 12, Street 4, DHA Phase 6', city: 'Lahore' },
    items: [{ id: 'p1', name: 'Aaira Embroidered Lawn — 3pc', price: 6490, qty: 1 }],
    subtotal: 6490, discount: 0, shipping: 0, total: 6490, promoCode: null,
    paymentMethod: 'cod', status: 'delivered',
    dispatch: { courier: 'Leopards Courier', trackingNo: 'LC-88213', dispatchedAt: '2026-09-11T09:00:00Z' },
    invoice: { invoiceNo: 'INV-8799', issuedAt: '2026-09-11T09:00:00Z' },
  },
  {
    id: 'o2', orderNo: '#1041', createdAt: '2026-09-12T14:20:00Z',
    customer: { name: 'Bilal R.', phone: '0321-9988776', address: 'Flat 3B, Gulshan Block 7', city: 'Karachi' },
    items: [{ id: 'p3', name: 'Zoya Karandi Kurta — Stitched', price: 2450, qty: 1 }, { id: 'p8', name: 'Kiran Pearl Jhumka Set', price: 1450, qty: 1 }],
    subtotal: 3900, discount: 0, shipping: 250, total: 4150, promoCode: null,
    paymentMethod: 'card', status: 'dispatched',
    dispatch: { courier: 'TCS', trackingNo: 'TCS-55019', dispatchedAt: '2026-09-13T11:00:00Z' },
    invoice: { invoiceNo: 'INV-8800', issuedAt: '2026-09-13T11:00:00Z' },
  },
]

export function OrdersProvider({ children }) {
  const [orders, setOrders] = usePersistentState('orders', SEED_ORDERS, isArrayOf(isOrder))

  // Mirror of `orders` so number generation always sees the latest list, even when
  // several actions land before React re-renders.
  const ordersRef = useRef(orders)
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  function placeOrder({ customer, items, subtotal, discount, shipping, total, promoCode, paymentMethod }) {
    const orderSeq = highest(ordersRef.current, (o) => o.orderNo, 1042) + 1
    const order = {
      id: newId('o'),
      orderNo: '#' + orderSeq,
      createdAt: new Date().toISOString(),
      customer, items, subtotal, discount, shipping, total, promoCode,
      paymentMethod, status: 'pending', dispatch: null, invoice: null,
    }
    ordersRef.current = [order, ...ordersRef.current]
    setOrders((prev) => [order, ...prev])
    return order
  }

  const value = { orders, placeOrder }

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider')
  return ctx
}