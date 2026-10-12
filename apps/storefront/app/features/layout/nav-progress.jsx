import { useNavigation } from 'react-router'

/** A thin bar at the top while a page is on its way (plan/06-storefront/10-performance.md section 8). It only decorates: the page itself says nothing about loading, so it is hidden from screen readers. */
export function NavProgress() {
  const navigation = useNavigation()
  return navigation.state === 'idle' ? null : <div aria-hidden="true" className="nav-progress fixed inset-x-0 top-0 z-50 h-0.5 bg-accent" />
}
