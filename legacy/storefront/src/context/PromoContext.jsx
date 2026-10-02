import { createContext, useContext, useMemo } from 'react'
import { usePersistentState, isObj, isArrayOf, isStr, isNum } from '../hooks/usePersistentState'
import { INITIAL_PROMO_CODES } from '../data/mockData'

const PromoContext = createContext(null)

const isPromo = (p) =>
  isObj(p) && isStr(p.id) && isStr(p.code) && isStr(p.type) &&
  isNum(p.value) && isNum(p.minSpend) && isNum(p.usageLimit) && isNum(p.used)

export function PromoProvider({ children }) {
  const [promoCodes, setPromoCodes] = usePersistentState('promos', INITIAL_PROMO_CODES, isArrayOf(isPromo))

  function recordUsage(id) {
    setPromoCodes((prev) => prev.map((p) => (p.id === id ? { ...p, used: p.used + 1 } : p)))
  }

  // returns { ok, promo, discount, message }
  function validatePromo(code, subtotal) {
    const promo = promoCodes.find((p) => p.code.toLowerCase() === code.trim().toLowerCase())
    if (!promo) return { ok: false, message: 'That promo code doesn\u2019t exist.' }
    if (promo.status !== 'active') return { ok: false, message: 'This code has expired.' }
    if (new Date(promo.expiry) < new Date()) return { ok: false, message: 'This code has expired.' }
    if (promo.used >= promo.usageLimit) return { ok: false, message: 'This code has reached its usage limit.' }
    if (subtotal < promo.minSpend) {
      return { ok: false, message: `Add ${promo.minSpend - subtotal >= 0 ? 'more to your bag' : ''} — minimum spend is Rs ${promo.minSpend.toLocaleString()}.` }
    }
    const discount = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value
    return { ok: true, promo, discount: Math.min(discount, subtotal) }
  }

  const value = useMemo(
    () => ({ promoCodes, recordUsage, validatePromo }),
    [promoCodes]
  )

  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>
}

export function usePromo() {
  const ctx = useContext(PromoContext)
  if (!ctx) throw new Error('usePromo must be used within PromoProvider')
  return ctx
}