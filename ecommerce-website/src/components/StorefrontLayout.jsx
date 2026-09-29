import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useStoreConfig } from '../hooks/useStoreConfig'
import { useCatalog } from '../context/CatalogContext'
import CartDrawer from './CartDrawer'

// Uploaded logo when the store settings provide one; the text name otherwise, or if the image fails.
function StoreLogo({ name, logoUrl }) {
  const [failedUrl, setFailedUrl] = useState(null)
  if (!logoUrl || failedUrl === logoUrl) return name
  return <img className="sf-logo-img" src={logoUrl} alt={name} onError={() => setFailedUrl(logoUrl)} />
}

export default function StorefrontLayout() {
  const { itemCount, setDrawerOpen } = useCart()
  const store = useStoreConfig()
  const { categoryTree, status: catalogStatus, error: catalogError, retry } = useCatalog()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openCat, setOpenCat] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function closeAll() {
    setMenuOpen(false)
    setOpenCat(null)
  }

  function submitSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`)
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <div className="storefront" data-theme={store.theme}>
      <div className="top-bar">Free delivery on orders over Rs 5,000 · Cash on delivery available nationwide</div>

      <header className="sf-header">
        <button className="sf-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
        <Link to="/" className="sf-logo" onClick={closeAll} aria-label={`${store.storeName} home`}>
          <StoreLogo name={store.storeName} logoUrl={store.logoUrl} />
        </Link>

        <nav className={'mega-nav' + (menuOpen ? ' open' : '')}>
          <ul>
            <li><NavLink to="/" end onClick={closeAll}>Home</NavLink></li>
            <li><NavLink to="/shop" end onClick={closeAll}>Shop All</NavLink></li>
            {categoryTree.map((cat) => (
              <li
                key={cat.name}
                className="mega-item"
                onMouseEnter={() => setOpenCat(cat.name)}
                onMouseLeave={() => setOpenCat((c) => (c === cat.name ? null : c))}
              >
                <button
                  className="mega-trigger"
                  onClick={() => setOpenCat((c) => (c === cat.name ? null : cat.name))}
                  aria-expanded={openCat === cat.name}
                >
                  {cat.name}
                </button>
                {cat.subcategories?.length > 0 && (
                  <div className={'mega-panel' + (openCat === cat.name ? ' show' : '')}>
                    <Link
                      to={`/shop?category=${encodeURIComponent(cat.name)}`}
                      className="mega-all"
                      onClick={closeAll}
                    >
                      All {cat.name} →
                    </Link>
                    <ul>
                      {cat.subcategories.map((sub) => (
                        <li key={sub}>
                          <Link
                            to={`/shop?category=${encodeURIComponent(cat.name)}&sub=${encodeURIComponent(sub)}`}
                            onClick={closeAll}
                          >
                            {sub}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
            <li><NavLink to="/shop?tag=new" onClick={closeAll}>New In</NavLink></li>
            <li><NavLink to="/shop?tag=sale" onClick={closeAll}>Sale</NavLink></li>
          </ul>
        </nav>

        <div className="sf-icons">
          <button className="sf-icon-btn sf-search-btn" onClick={() => setSearchOpen((v) => !v)} aria-label="Search">
            🔍
          </button>
          <Link to="/wishlist" className="sf-icon-btn sf-wishlist-btn" aria-label="Wishlist">♡</Link>
          <button className="sf-icon-btn sf-cart-btn" onClick={() => setDrawerOpen(true)} aria-label="Open cart">
            Bag {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="search-bar-wrap">
          <form className="container search-bar" onSubmit={submitSearch}>
            <input
              autoFocus
              type="search"
              placeholder="Search for lawn suits, kurtas, dupattas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-gold btn-sm">Search</button>
          </form>
        </div>
      )}

      {catalogStatus === 'error' && (
        <div className="catalog-error" role="alert">
          <span>{catalogError || 'Could not load the catalog'}. Showing our sample collection for now.</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={retry}>Try again</button>
        </div>
      )}

      <main><Outlet /></main>

      <footer className="sf-footer">
        <div className="container foot-grid">
          <div>
            <h3 className="foot-logo">{store.storeName}</h3>
            <p>Contemporary Pakistani fashion — lawn, formals and accessories made to last, delivered nationwide.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              {categoryTree.slice(0, 4).map((cat) => (
                <li key={cat.name}><Link to={`/shop?category=${encodeURIComponent(cat.name)}`}>{cat.name}</Link></li>
              ))}
              <li><Link to="/shop">Shop all</Link></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><Link to="/pages/shipping-returns">Shipping &amp; returns</Link></li>
              <li><Link to="/pages/size-guide">Size guide</Link></li>
              <li><Link to="/track-order">Track your order</Link></li>
              <li><Link to="/pages/contact">Contact us</Link></li>
            </ul>
          </div>
          <div>
            <h4>Stay in the loop</h4>
            <p>New drops and promo codes, once in a while.</p>
            <form className="newsletter" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Your email" required />
              <button className="btn btn-gold btn-sm" type="submit">Join</button>
            </form>
          </div>
        </div>
        <div className="container foot-bottom">
          <span>© 2026 {store.storeName}. All rights reserved.</span>
          <span>{store.subdomain}.mystore.pk</span>
        </div>
      </footer>

      <CartDrawer />
    </div>
  )
}