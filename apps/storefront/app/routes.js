import { index, layout, prefix, route } from '@react-router/dev/routes'

// Every storefront address (plan/06-storefront/01-sitemap.md section 2), once for English and once under `/ur`. A route needs an id of its own for each copy.
// The root loader answers 404 for `/ur` while the shop has not switched Urdu on; `/en` and any other first segment are just unknown addresses.
/** @param {string} id suffix */
const pages = (id) => [
  layout('routes/_shell.jsx', { id: `shell${id}` }, [
    index('routes/home.jsx', { id: `home${id}` }),
    route('c/:handle', 'routes/category.jsx', { id: `category${id}` }),
    route('collections/:handle', 'routes/collection.jsx', { id: `collection${id}` }),
    route('new', 'routes/new.jsx', { id: `new${id}` }),
    route('sale', 'routes/sale.jsx', { id: `sale${id}` }),
    route('search', 'routes/search.jsx', { id: `search${id}` }),
    route('p/:handle', 'routes/product.jsx', { id: `product${id}` }),
    route('reviews/:id', 'routes/reviews.js', { id: `reviews${id}` }),
    route('recent', 'routes/recent.js', { id: `recent${id}` }),
    route('cart', 'routes/cart.jsx', { id: `cart${id}` }),
    route('checkout', 'routes/checkout.jsx', { id: `checkout${id}` }),
    route('orders/:token', 'routes/order.jsx', { id: `order${id}` }),
    route('orders/:token/review/:lineId', 'routes/order-review.jsx', { id: `order-review${id}` }),
    route('orders/:token/review/:lineId/photo', 'routes/review-photo.js', { id: `review-photo${id}` }),
    route('track', 'routes/track.jsx', { id: `track${id}` }),
    route('wishlist', 'routes/wishlist.jsx', { id: `wishlist${id}` }),
    route('pages/:slug', 'routes/page.jsx', { id: `page${id}` }),
    route('size-guide', 'routes/size-guide.jsx', { id: `size-guide${id}` }),
    route('*', 'routes/not-found.jsx', { id: `not-found${id}` }),
  ]),
]

// ponytail: sitemap.xml and robots.txt come with the SEO task (M5-10).
export default /** @satisfies {import('@react-router/dev/routes').RouteConfig} */ ([route('healthz', 'routes/healthz.js'), ...pages(''), ...prefix('ur', pages('-ur'))])
