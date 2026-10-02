// Loading placeholders shown while the catalog / settings load from the API.
// Purely decorative: each wrapper carries aria-busy + a visually hidden label for screen readers.

export function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="products" aria-busy="true">
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="product-card" key={i} aria-hidden="true">
          <div className="skeleton skel-media" />
          <div className="pc-body">
            <div className="skeleton skel-line short" />
            <div className="skeleton skel-line" />
            <div className="skeleton skel-line short" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProductPageSkeleton() {
  return (
    <div className="pd-wrap" aria-busy="true">
      <span className="sr-only">Loading product…</span>
      <div aria-hidden="true">
        <div className="skeleton skel-media skel-pd-main" />
        <div className="pd-thumbs">
          {Array.from({ length: 4 }, (_, i) => <div className="skeleton skel-thumb" key={i} />)}
        </div>
      </div>
      <div className="pd-info" aria-hidden="true">
        <div className="skeleton skel-line short" />
        <div className="skeleton skel-line tall" />
        <div className="skeleton skel-line short" />
        <div className="skeleton skel-block" />
        <div className="skeleton skel-line" />
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <section className="hero-carousel" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="skeleton skel-hero" aria-hidden="true" />
    </section>
  )
}
