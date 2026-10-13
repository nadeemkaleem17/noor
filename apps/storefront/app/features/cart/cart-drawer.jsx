import { createContext, lazy, Suspense, use, useState } from 'react'
import { useLocation } from 'react-router'

const DrawerState = createContext(/** @type {{ open: boolean, setOpen: (open: boolean) => void }} */ ({ open: false, setOpen: () => {} }))

/** Opens and closes the cart drawer from anywhere in the shop: the cart link of the header, the product page after an add. */
export const useCartDrawer = () => use(DrawerState)

/** The panel is a file of its own (the drawer, the lines, the quantity stepper, the summary): a visitor who never opens the cart panel never downloads it. */
const CartPanel = lazy(() => import('./cart-panel'))

/** @param {{ children: import('react').ReactNode }} props */
export function CartDrawerProvider({ children }) {
  const [open, setOpen] = useState(false)
  // once opened, the panel stays mounted (closed) so that its close animation and its next opening are as before
  const [opened, setOpened] = useState(false)
  if (open && !opened) setOpened(true)
  // a page change closes it: the panel loads on first use, so a link pressed meanwhile ("View cart" after an add) must not find it open over the next page
  const { pathname } = useLocation()
  const [page, setPage] = useState(pathname)
  if (page !== pathname) {
    setPage(pathname)
    setOpen(false)
  }
  return (
    <DrawerState.Provider value={{ open, setOpen }}>
      {children}
      {opened ? (
        <Suspense fallback={null}>
          <CartPanel />
        </Suspense>
      ) : null}
    </DrawerState.Provider>
  )
}
