import { createContext, useContext, useMemo } from 'react'
import { usePersistentState, isArrayOf, isStr } from '../hooks/usePersistentState'

const WishlistContext = createContext(null)

export function WishlistProvider({ children }) {
  const [ids, setIds] = usePersistentState('wishlist', [], isArrayOf(isStr))

  function toggle(id) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function has(id) {
    return ids.includes(id)
  }

  const value = useMemo(() => ({ ids, toggle, has }), [ids])

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
