import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePersistentState, isObj, isArrayOf, isStr, isNum } from '../hooks/usePersistentState'
import { CATEGORIES, CATEGORY_TREE, INITIAL_PRODUCTS } from '../data/mockData'
import { apiEnabled, apiGet } from '../utils/api'
import { catalogFromContract, withMockImages } from '../utils/catalogAdapter'

const CatalogContext = createContext(null)

const isProduct = (p) => isObj(p) && isStr(p.id) && isStr(p.name) && isNum(p.price) && isNum(p.stock)
const isTreeNode = (c) => isObj(c) && isStr(c.name) && Array.isArray(c.subcategories)

// Where the catalog comes from:
//  - VITE_API_URL unset: the mock catalog, persisted to localStorage exactly as before.
//  - VITE_API_URL set:   GET /api/public/products + /categories, held in memory only (the server
//                        owns stock). If the request fails we fall back to the mock catalog and
//                        report status 'error' so the layout can say so and offer a retry.
// status: 'ready' | 'loading' | 'error'
export function CatalogProvider({ children }) {
  const [mockProducts, setMockProducts] = usePersistentState('catalog-products', INITIAL_PRODUCTS, isArrayOf(isProduct))
  const [mockCategories] = usePersistentState('catalog-categories', CATEGORIES, isArrayOf(isStr))
  const [mockTree] = usePersistentState('catalog-category-tree', CATEGORY_TREE, isArrayOf(isTreeNode))

  const [remote, setRemote] = useState(null) // { products, categories, categoryTree } from the API
  const [status, setStatus] = useState(apiEnabled ? 'loading' : 'ready')
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState({ n: 0, silent: false })

  useEffect(() => {
    if (!apiEnabled) return
    const controller = new AbortController()
    const { silent } = attempt
    Promise.all([
      apiGet('/api/public/products', { signal: controller.signal }),
      apiGet('/api/public/categories', { signal: controller.signal }),
    ])
      .then(([products, categories]) => {
        if (!Array.isArray(products) || !Array.isArray(categories)) throw new Error('Unexpected catalog format')
        setRemote(catalogFromContract(products, categories))
        setError(null)
        setStatus('ready')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (silent) return // a background refresh failing keeps whatever is already on screen
        setRemote(null)
        setError(err.message || 'Could not load the catalog')
        setStatus('error')
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setStatus('loading')
    setError(null)
    setAttempt((a) => ({ n: a.n + 1, silent: false }))
  }, [])

  // Re-fetch in the background (no skeletons): after checkout, and when the tab regains focus so
  // changes made in the admin (new products, prices, stock) show up without a manual reload.
  const refresh = useCallback(() => {
    if (apiEnabled) setAttempt((a) => ({ n: a.n + 1, silent: true }))
  }, [])
  useEffect(() => {
    if (!apiEnabled) return
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const usingRemote = remote !== null
  // While an API request is in flight, show nothing rather than flashing the mock catalog.
  const { products, categories, categoryTree } = useMemo(() => {
    if (usingRemote) return remote
    if (apiEnabled && status === 'loading') return { products: [], categories: [], categoryTree: [] }
    return { products: mockProducts.map(withMockImages), categories: mockCategories, categoryTree: mockTree }
  }, [usingRemote, remote, status, mockProducts, mockCategories, mockTree])

  const decrementStock = useCallback((items) => {
    const apply = (list) => list.map((p) => {
      const line = items.find((i) => i.id === p.id)
      return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p
    })
    // API stock is only adjusted in memory until the next load; the server is the source of truth.
    if (usingRemote) setRemote((r) => (r ? { ...r, products: apply(r.products) } : r))
    else setMockProducts(apply)
  }, [usingRemote, setMockProducts])

  const getProduct = useCallback((id) => products.find((p) => p.id === id), [products])

  const getRelated = useCallback((product, limit = 4) => {
    if (!product) return []
    return products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, limit)
  }, [products])

  const value = useMemo(
    () => ({
      products, categories, categoryTree,
      status, error, retry, refresh, source: usingRemote ? 'api' : 'mock',
      decrementStock, getProduct, getRelated,
    }),
    [products, categories, categoryTree, status, error, retry, refresh, usingRemote, decrementStock, getProduct, getRelated]
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider')
  return ctx
}
