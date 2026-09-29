import { Routes, Route } from 'react-router-dom'
import StorefrontLayout from './components/StorefrontLayout'
import Home from './pages/storefront/Home'
import Shop from './pages/storefront/Shop'
import Product from './pages/storefront/Product'
import Cart from './pages/storefront/Cart'
import Checkout from './pages/storefront/Checkout'
import OrderConfirmation from './pages/storefront/OrderConfirmation'
import TrackOrder from './pages/storefront/TrackOrder'
import CmsPage from './pages/storefront/CmsPage'
import Wishlist from './pages/storefront/Wishlist'
import ComingSoon from './pages/storefront/ComingSoon'

export default function App() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/pages/:slug" element={<CmsPage />} />
        <Route path="/wishlist" element={<Wishlist />} />
      </Route>


      <Route path="*" element={<ComingSoon title="Page not found" />} />
    </Routes>
  )
}
