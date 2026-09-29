import { useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import ProductCard from '../../components/ProductCard'
import { ProductImage, EmptyState } from '../../components/ui'
import { ProductPageSkeleton } from '../../components/Skeletons'
import { formatPKR } from '../../utils/format'

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="accordion-item">
      <button className="accordion-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <span className="accordion-icon">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

export default function Product() {
  const { id } = useParams()
  const { getProduct, getRelated, status } = useCatalog()
  const { addItem } = useCart()
  const { toggle, has } = useWishlist()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [qty, setQty] = useState(1)
  const [sizeError, setSizeError] = useState(false)

  const product = getProduct(id)
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0
  const selectedSize = searchParams.get('size') || ''
  // images[] is already ordered by the catalog: primary image first, then by sortOrder.
  const images = product?.images?.length ? product.images : [{ url: undefined, alt: product?.name }]
  const [activeImage, setActiveImage] = useState(0)
  const shownImage = Math.min(activeImage, images.length - 1)
  const related = getRelated(product, 4)

  // The route stays on the same component instance across /product/:id navigations
  // (e.g. clicking a related product), so local UI state must be reset explicitly —
  // otherwise a stale qty from a higher-stock product could exceed the new one's stock.
  // Resetting synchronously during render (React's documented "adjusting state when a
  // prop changes" pattern) instead of in an effect avoids an extra cascading render.
  const [lastId, setLastId] = useState(id)
  if (id !== lastId) {
    setLastId(id)
    setQty(1)
    setActiveImage(0)
    setSizeError(false)
  }

  if (!product && status === 'loading') return <ProductPageSkeleton />

  if (!product) {
    return (
      <div className="container section">
        <EmptyState
          title="Product not found"
          body="This product may have been removed."
          action={<Link to="/shop" className="btn btn-gold btn-sm">Back to shop</Link>}
        />
      </div>
    )
  }

  const outOfStock = product.stock === 0

  function selectSize(size) {
    setSizeError(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('size', size)
      return next
    }, { replace: true })
  }

  function validateSize() {
    if (hasSizes && !selectedSize) {
      setSizeError(true)
      return false
    }
    return true
  }

  function handleAdd() {
    if (!validateSize()) return
    addItem(product, qty, hasSizes ? selectedSize : null)
  }

  function handleBuyNow() {
    if (!validateSize()) return
    addItem(product, qty, hasSizes ? selectedSize : null)
    navigate('/checkout')
  }

  return (
    <div className="page-wrap">
      <nav className="breadcrumbs container">
        <Link to="/">Home</Link> / <Link to="/shop">Shop</Link> /{' '}
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link> / <span>{product.name}</span>
      </nav>

      <div className="pd-wrap">
        <div className="pd-gallery">
          <div className="pd-gallery-main">
            <ProductImage
              src={images[shownImage].url} seed={`${product.id}-${shownImage}`} index={product.swatch}
              label={images[shownImage].alt || `${product.name} — image ${shownImage + 1}`}
              size="lg" width={800} height={1000} loading="eager"
            />
          </div>
          {images.length > 1 && (
            <div className="pd-thumbs">
              {images.map((img, i) => (
                <button
                  key={`${i}-${img.url}`}
                  className={'pd-thumb' + (i === shownImage ? ' active' : '')}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}${img.alt ? `: ${img.alt}` : ''}`}
                  aria-pressed={i === shownImage}
                >
                  <ProductImage src={img.url} seed={`${product.id}-${i}`} index={product.swatch} label="" size="sm" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <span className="pc-category">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}</span>
          <h1>{product.name}</h1>
          <div className="pd-price-row">
            <span className="pd-price">{formatPKR(product.price)}</span>
            {product.compareAt && <span className="pc-compare">{formatPKR(product.compareAt)}</span>}
          </div>
          <p className="pd-desc">{product.description}</p>

          {hasSizes && (
            <div className="pd-size-row">
              <div className="pd-size-head">
                <span>Size{selectedSize ? `: ${selectedSize}` : ''}</span>
                <Link to="/pages/size-guide" className="size-guide-link">Size guide</Link>
              </div>
              <div className="size-options">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    className={'size-btn' + (selectedSize === size ? ' active' : '')}
                    onClick={() => selectSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {sizeError && <p className="pd-size-error">Please select a size.</p>}
            </div>
          )}

          <p className={'pd-stock ' + (outOfStock ? 'out' : 'in')}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          {!outOfStock && (
            <div className="pd-qty-row">
              <div className="qty-row">
                <button className="qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-val">{qty}</span>
                <button className="qty-btn" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}>+</button>
              </div>
            </div>
          )}

          <div className="pd-actions">
            <button className="btn btn-outline" disabled={outOfStock} onClick={handleAdd}>
              {outOfStock ? 'Sold out' : 'Add to bag'}
            </button>
            {!outOfStock && (
              <button className="btn btn-gold" onClick={handleBuyNow}>Buy now</button>
            )}
            <button
              className={'btn btn-outline pd-wish-btn' + (has(product.id) ? ' active' : '')}
              onClick={() => toggle(product.id)}
              aria-pressed={has(product.id)}
            >
              {has(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}
            </button>
          </div>

          <div className="pd-accordions">
            <Accordion title="Details & care" defaultOpen>
              <p>{product.description} Sku: {product.sku}.</p>
              <p>Hand wash separately in cold water. Do not bleach. Iron on reverse at low heat.</p>
            </Accordion>
            <Accordion title="Delivery & returns">
              <p>Delivered in 3–5 business days nationwide. Cash on delivery available. Free delivery on orders over Rs 5,000.</p>
              <p>7-day easy return on unused items with original tags.</p>
            </Accordion>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>You may also like</h2>
          </div>
          <div className="products">
            {related.map((p) => <ProductCard product={p} key={p.id} />)}
          </div>
        </section>
      )}
    </div>
  )
}
