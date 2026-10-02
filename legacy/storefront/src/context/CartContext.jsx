import { createContext, useContext, useMemo, useState } from 'react'
import { usePersistentState, isObj, isArrayOf, isStr, isNum } from '../hooks/usePersistentState'
import { variantFor } from '../utils/catalogAdapter'

const CartContext = createContext(null)

const isCartLine = (i) =>
  isObj(i) && isStr(i.key) && isStr(i.id) && isStr(i.name) &&
  isNum(i.price) && isNum(i.qty) && i.qty > 0 &&
  (i.size === null || isStr(i.size)) &&
  (i.image === undefined || isStr(i.image)) && // optional: lines saved before images existed have none
  (i.variantId === undefined || isStr(i.variantId)) // only set for API products
const isAppliedPromo = (v) =>
  v === null || (isObj(v) && isObj(v.promo) && isStr(v.promo.code) && isNum(v.discount))

// Line identity is `productId` + `size` (when the product has sizes), so adding the
// same product in two different sizes creates two separate lines instead of merging.
function lineKey(id, size) {
  return size ? `${id}__${size}` : id
}

export function CartProvider({ children }) {
  const [items, setItems] = usePersistentState('cart', [], isArrayOf(isCartLine)) // { key, id, name, price, swatch, stock, size, qty, image?, variantId?, sku? }
  const [appliedPromo, setAppliedPromo] = usePersistentState('cart-promo', null, isAppliedPromo) // { promo, discount }
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  function addItem(product, qty = 1, size = null) {
    const key = lineKey(product.id, size)
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, i.stock || i.qty + qty) } : i))
      }
      const image = product.images?.[0]?.url
      // API products: charge and cap stock by the chosen variant, and remember it for checkout.
      const variant = variantFor(product, size)
      return [...prev, {
        key, id: product.id, name: product.name,
        price: variant ? variant.price : product.price,
        stock: variant ? variant.stock : product.stock,
        swatch: product.swatch, size, qty,
        ...(image && { image }),
        ...(variant && { variantId: variant.id, sku: variant.sku }),
      }]
    })
    setDrawerOpen(true)
  }

  function updateQty(key, qty) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty } : i)).filter((i) => i.qty > 0))
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function clearCart() {
    setItems([])
    setAppliedPromo(null)
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items])
  const discount = appliedPromo ? appliedPromo.discount : 0
  const shipping = items.length === 0 || subtotal >= 5000 ? 0 : 250
  const total = Math.max(0, subtotal - discount) + shipping
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0)

  const value = {
    items, addItem, updateQty, removeItem, clearCart,
    appliedPromo, setAppliedPromo,
    isDrawerOpen, setDrawerOpen,
    subtotal, discount, shipping, total, itemCount,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
