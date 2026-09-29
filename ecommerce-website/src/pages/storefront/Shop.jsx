import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import ProductCard from '../../components/ProductCard'
import { EmptyState } from '../../components/ui'

export default function Shop() {
  const { products, categoryTree } = useCatalog()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') || ''
  const activeSub = searchParams.get('sub') || ''
  const activeTag = searchParams.get('tag') || ''
  const query = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'featured'

  const activeCategoryNode = categoryTree.find((c) => c.name === activeCategory)

  const filtered = useMemo(() => {
    let list = products

    if (activeCategory) list = list.filter((p) => p.category === activeCategory)
    if (activeSub) list = list.filter((p) => p.subcategory === activeSub)
    if (activeTag === 'sale') list = list.filter((p) => !!p.compareAt)
    else if (activeTag) list = list.filter((p) => p.tags?.includes(activeTag))
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    }

    const sorted = [...list]
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
    else if (sort === 'newest') sorted.sort((a, b) => (b.tags?.includes('new') ? 1 : 0) - (a.tags?.includes('new') ? 1 : 0))

    return sorted
  }, [products, activeCategory, activeSub, activeTag, query, sort])

  function setCategory(cat) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!cat) { next.delete('category'); next.delete('sub') } else { next.set('category', cat); next.delete('sub') }
      return next
    })
  }

  function setSub(sub) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!sub) next.delete('sub'); else next.set('sub', sub)
      return next
    })
  }

  function setSort(value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'featured') next.delete('sort'); else next.set('sort', value)
      return next
    })
  }

  function clearAll() {
    setSearchParams({})
  }

  const heading = query ? `Results for "${query}"` : activeCategory || 'Shop all'

  return (
    <div>
      <div className="shop-head">
        <h1>{heading}</h1>
        <p>{filtered.length} product{filtered.length === 1 ? '' : 's'}{activeSub ? ` in ${activeSub}` : ''}</p>
      </div>

      <div className="filter-bar">
        <button className={'filter-chip' + (activeCategory === '' ? ' active' : '')} onClick={() => setCategory('')}>All</button>
        {categoryTree.map((cat) => (
          <button
            key={cat.name}
            className={'filter-chip' + (activeCategory === cat.name ? ' active' : '')}
            onClick={() => setCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {activeCategoryNode?.subcategories?.length > 0 && (
        <div className="filter-bar sub-filter-bar">
          <button className={'filter-chip sub' + (activeSub === '' ? ' active' : '')} onClick={() => setSub('')}>All {activeCategoryNode.name}</button>
          {activeCategoryNode.subcategories.map((sub) => (
            <button
              key={sub}
              className={'filter-chip sub' + (activeSub === sub ? ' active' : '')}
              onClick={() => setSub(sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      <div className="container sort-row">
        <span className="sort-label">Sort by</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>

      <div className="container section" style={{ paddingTop: 0 }}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No results"
            body="Try removing a filter or searching for something else."
            action={<button className="btn btn-outline btn-sm" onClick={clearAll}>Clear all filters</button>}
          />
        ) : (
          <div className="products">
            {filtered.map((p) => <ProductCard product={p} key={p.id} />)}
          </div>
        )}
      </div>
    </div>
  )
}
