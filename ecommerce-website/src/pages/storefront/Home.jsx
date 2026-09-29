import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { useStoreConfig } from '../../hooks/useStoreConfig'
import ProductCard from '../../components/ProductCard'
import { ProductImage } from '../../components/ui'

export default function Home() {
  const { products, categories } = useCatalog()
  const store = useStoreConfig()
  const bestsellers = products.filter((p) => p.tags?.includes('bestseller')).slice(0, 4)
  const newArrivals = products.filter((p) => p.tags?.includes('new')).slice(0, 4)
  const featured = bestsellers.length ? bestsellers : products.slice(0, 4)
  const heroProduct = featured[0]

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Autumn edit, new in</span>
          <h1>Wear your confidence, thread by thread.</h1>
          <p>Hand-finished lawn, kurtas and formals — designed in Lahore, cut for everyday wear, delivered to your door across Pakistan.</p>
          <div className="hero-actions">
            <Link to="/shop" className="btn btn-gold">Shop the edit</Link>
            <Link to="/shop?category=Lawn+Suits" className="btn btn-outline">Explore lawn</Link>
          </div>
        </div>
        <div className="hero-img">
          <ProductImage seed="hero-main" index={0} label={`${store.storeName} — new season edit`} size="hero" width={1000} height={800} />
          {heroProduct && <span className="hero-tag">{heroProduct.name} — from Rs {heroProduct.price.toLocaleString('en-PK')}</span>}
        </div>
      </section>

      <section className="trust-strip container">
        <div><span className="trust-icon">🚚</span><span>Free delivery over Rs 5,000</span></div>
        <div><span className="trust-icon">💵</span><span>Cash on delivery nationwide</span></div>
        <div><span className="trust-icon">↩️</span><span>7-day easy returns</span></div>
        <div><span className="trust-icon">✅</span><span>100% authentic fabric</span></div>
      </section>

      <section className="cat-strip container">
        {categories.map((cat, i) => (
          <Link to={`/shop?category=${encodeURIComponent(cat)}`} key={cat} className="cat-tile">
            <ProductImage seed={`cat-${cat}`} index={i} label={cat} size="md" width={200} height={200} />
            <span>{cat}</span>
          </Link>
        ))}
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Bestsellers</h2>
          <Link to="/shop?tag=bestseller">View all →</Link>
        </div>
        <div className="products">
          {featured.map((p) => <ProductCard product={p} key={p.id} />)}
        </div>
      </section>

      <section className="promo-band">
        <div className="container promo-band-inner">
          <div>
            <span className="eyebrow">Limited time</span>
            <h2>10% off your first order</h2>
            <p>Use code <strong>RUBAYA10</strong> at checkout on orders above Rs 3,000.</p>
          </div>
          <Link to="/shop" className="btn btn-gold">Start shopping</Link>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>New arrivals</h2>
          <Link to="/shop?tag=new">View all →</Link>
        </div>
        <div className="products">
          {newArrivals.map((p) => <ProductCard product={p} key={p.id} />)}
        </div>
      </section>

      <section className="editorial-band container">
        <div className="editorial-copy">
          <span className="eyebrow">The edit</span>
          <h2>Festive dressing, made effortless.</h2>
          <p>From everyday lawn to occasion-ready formals — our stylists picked the pieces that carry a look from morning tea to evening mehndi without a wardrobe change.</p>
          <Link to="/shop?category=Lawn+Suits" className="btn btn-outline">Shop the story</Link>
        </div>
        <div className="editorial-media">
          <ProductImage seed="editorial-story" index={2} label="Festive edit" size="hero" width={900} height={700} />
        </div>
      </section>
    </>
  )
}
