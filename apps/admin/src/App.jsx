import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from './components/AdminLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ProductsList from './pages/products/ProductsList.jsx'
import ProductEditor from './pages/products/ProductEditor.jsx'
import Categories from './pages/catalog/Categories.jsx'
import Collections from './pages/catalog/Collections.jsx'
import DataPublishing from './pages/data/DataPublishing.jsx'
import Attributes from './pages/catalog/Attributes.jsx'
import Sizes from './pages/catalog/Sizes.jsx'
import OrdersList from './pages/orders/OrdersList.jsx'
import OrderDetail from './pages/orders/OrderDetail.jsx'
import Promos from './pages/promos/Promos.jsx'
import Reviews from './pages/Reviews.jsx'
import Pages from './pages/content/Pages.jsx'
import Menus from './pages/content/Menus.jsx'
import Templates from './pages/content/Templates.jsx'
import Settings from './pages/store/Settings.jsx'
import SiteSettings from './pages/store/SiteSettings.jsx'
import Shipping from './pages/store/Shipping.jsx'
import Appearance from './pages/store/Appearance.jsx'
import NotFound from './pages/NotFound.jsx'
import { ToastProvider } from './components/Toast.jsx'
import * as Tooltip from '@radix-ui/react-tooltip'

export default function App() {
  return (
    <BrowserRouter>
      <Tooltip.Provider delayDuration={300}>
      <ToastProvider>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/products" element={<ProductsList />} />
            <Route path="/products/:id" element={<ProductEditor />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/attributes" element={<Attributes />} />
            <Route path="/sizes" element={<Sizes />} />

            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/promos" element={<Promos />} />
            <Route path="/reviews" element={<Reviews />} />

            <Route path="/pages" element={<Pages />} />
            <Route path="/menus" element={<Menus />} />
            <Route path="/templates" element={<Templates />} />

            <Route path="/site" element={<SiteSettings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/appearance" element={<Appearance />} />
            <Route path="/shipping" element={<Shipping />} />

            <Route path="/data" element={<DataPublishing />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
      </Tooltip.Provider>
    </BrowserRouter>
  )
}