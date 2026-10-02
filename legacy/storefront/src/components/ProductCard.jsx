import { Link } from 'react-router-dom'
import { ProductImage } from './ui'
import { formatPKR } from '../utils/format'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const { toggle, has } = useWishlist()
  const wished = has(product.id)
  const outOfStock = product.stock === 0
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0

  return (
    <div className="product-card">
      <div className="pc-media">
        <Link to={`/product/${product.id}`} aria-label={product.name}>
          <ProductImage src={product.images?.[0]?.url} seed={`${product.id}-0`} index={product.swatch} label={product.name} size="lg" />
        </Link>
        {product.tags?.includes('new') && <span className="pc-new">New</span>}
        {product.compareAt && <span className="pc-sale">Sale</span>}
        {outOfStock && <span className="pc-oos">Sold out</span>}
        <button
          className={'pc-wish' + (wished ? ' active' : '')}
          onClick={() => toggle(product.id)}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
        >
          {wished ? '♥' : '♡'}
        </button>
      </div>
      <div className="pc-body">
        <span className="pc-category">{product.category}</span>
        <Link to={`/product/${product.id}`}><h3 className="pc-name">{product.name}</h3></Link>
        <div className="pc-price-row">
          <span className="pc-price">{formatPKR(product.price)}</span>
          {product.compareAt && <span className="pc-compare">{formatPKR(product.compareAt)}</span>}
        </div>
        {hasSizes ? (
          <Link to={`/product/${product.id}`} className="btn btn-outline btn-sm pc-add">
            {outOfStock ? 'Sold out' : 'Select size'}
          </Link>
        ) : (
          <button
            className="btn btn-outline btn-sm pc-add"
            disabled={outOfStock}
            onClick={() => addItem(product, 1)}
          >
            {outOfStock ? 'Sold out' : 'Add to bag'}
          </button>
        )}
      </div>
    </div>
  )
}