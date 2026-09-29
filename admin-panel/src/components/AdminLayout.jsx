import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Shirt, FolderTree, Tags, Ruler, ShoppingBag, Ticket,
  FileText, Menu as MenuIcon, Settings, Truck, Layers, DatabaseZap, MessageSquareText, LayoutTemplate,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, X,
} from 'lucide-react'
import { useCollection } from '../hooks/useCollection.js'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { useTheme } from '../hooks/useTheme.js'

const NAV = [
  {
    label: 'Overview',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products', icon: Shirt, label: 'Products', count: 'products' },
      { to: '/categories', icon: FolderTree, label: 'Categories' },
      { to: '/collections', icon: Layers, label: 'Collections' },
      { to: '/attributes', icon: Tags, label: 'Attributes' },
      { to: '/sizes', icon: Ruler, label: 'Sizes & Charts' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', icon: ShoppingBag, label: 'Orders', count: 'orders' },
      { to: '/promos', icon: Ticket, label: 'Promo codes' },
      { to: '/reviews', icon: MessageSquareText, label: 'Reviews' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/pages', icon: FileText, label: 'CMS pages' },
      { to: '/menus', icon: MenuIcon, label: 'Menus' },
      { to: '/templates', icon: LayoutTemplate, label: 'Page templates' },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/settings', icon: Settings, label: 'Store settings' },
      { to: '/shipping', icon: Truck, label: 'Shipping & payments' },
      { to: '/data', icon: DatabaseZap, label: 'Data & publishing' },
    ],
  },
]

function NavList({ collapsed, counts, onNavigate }) {
  return (
    <>
      {NAV.map((group) => (
        <div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map(({ to, icon: Icon, label, end, count }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              title={collapsed ? label : undefined}
              onClick={onNavigate}
            >
              <Icon />
              <span className="label">{label}</span>
              {count && counts[count] > 0 && <span className="count">{counts[count]}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </>
  )
}

export default function AdminLayout() {
  const { items: products } = useCollection('products')
  const { items: orders } = useCollection('orders')
  const counts = { products: products.length, orders: orders.filter((o) => o.status === 'pending').length }
  const [collapsed, setCollapsed] = usePersistentState('ui-sidebar-collapsed', false)
  const { resolved, toggle } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const [prevPath, setPrevPath] = useState(location.pathname)

  // Close the mobile drawer whenever the route changes (F-10).
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setMobileNavOpen(false)
  }

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-text">
            <span className="mark">01</span>
            <span className="name">Noor & Co. Admin</span>
          </div>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>
        <NavList collapsed={collapsed} counts={counts} />
      </aside>

      {mobileNavOpen && (
        <div className="mobile-nav-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="mobile-nav-scrim" onClick={() => setMobileNavOpen(false)} />
          <aside className="sidebar mobile-nav-drawer">
            <div className="sidebar-brand">
              <div className="brand-text">
                <span className="mark">01</span>
                <span className="name">Noor & Co. Admin</span>
              </div>
              <button type="button" className="collapse-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
                <X />
              </button>
            </div>
            <NavList collapsed={false} counts={counts} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="main">
        <div className="topbar topbar-mini">
          <button
            type="button"
            className="icon-btn mobile-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <div />
          <div className="topbar-right">
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {resolved === 'dark' ? <Sun /> : <Moon />}
            </button>
            <div className="avatar">NC</div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}