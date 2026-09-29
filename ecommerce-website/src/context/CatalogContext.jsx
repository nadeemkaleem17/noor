import { createContext, useContext, useMemo } from 'react'
import { usePersistentState, isObj, isArrayOf, isStr, isNum } from '../hooks/usePersistentState'
import { CATEGORIES, CATEGORY_TREE, INITIAL_PRODUCTS } from '../data/mockData'

const CatalogContext = createContext(null)

const isProduct = (p) => isObj(p) && isStr(p.id) && isStr(p.name) && isNum(p.price) && isNum(p.stock)
const isTreeNode = (c) => isObj(c) && isStr(c.name) && Array.isArray(c.subcategories)

export function CatalogProvider({ children }) {
  const [products, setProducts] = usePersistentState('catalog-products', INITIAL_PRODUCTS, isArrayOf(isProduct))
  const [categories] = usePersistentState('catalog-categories', CATEGORIES, isArrayOf(isStr))
  const [categoryTree] = usePersistentState('catalog-category-tree', CATEGORY_TREE, isArrayOf(isTreeNode))

  function decrementStock(items) {
    setProducts((prev) =>
      prev.map((p) => {
        const line = items.find((i) => i.id === p.id)
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p
      })
    )
  }

  function getProduct(id) {
    return products.find((p) => p.id === id)
  }

  function getRelated(product, limit = 4) {
    if (!product) return []
    return products
      .filter((p) => p.id !== product.id && p.category === product.category)
      .slice(0, limit)
  }

  const value = useMemo(
    () => ({
      products, categories, categoryTree,
      decrementStock,
      getProduct, getRelated,
    }),
    [products, categories, categoryTree]
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider')
  return ctx
}
