import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { useWishlist } from '../../context/WishlistContext'
import ProductCard from '../../components/ProductCard'
import { EmptyState } from '../../components/ui'

export default function Wishlist() {
  const { products } = useCatalog()
  const { ids } = useWishlist()
  const items = products.filter((p) => ids.includes(p.id))

  return (
    <div className="page-wrap">
      <h1 className="page-title">Your wishlist</h1>
      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          body="Tap the heart on anything you love and it'll show up here."
          action={<Link to="/shop" className="btn btn-gold btn-sm">Browse the shop</Link>}
        />
      ) : (
        <div className="products">
          {items.map((p) => <ProductCard product={p} key={p.id} />)}
        </div>
      )}
    </div>
  )
}
