import { CatalogProvider } from './CatalogContext'
import { PromoProvider } from './PromoContext'
import { CartProvider } from './CartContext'
import { OrdersProvider } from './OrdersContext'
import { WishlistProvider } from './WishlistContext'

export default function AppProviders({ children }) {
  return (
    <CatalogProvider>
      <PromoProvider>
        <OrdersProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
        </OrdersProvider>
      </PromoProvider>
    </CatalogProvider>
  )
}