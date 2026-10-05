import { createStaffI18n } from '@noor/i18n/staff'
import { DirectionProvider } from '@noor/ui/direction'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { RouterProvider } from 'react-router'
import { createRouter } from '@/app/router'
import { setCsrfToken } from '@/lib/api'
import { sessionEvents } from '@/lib/events'
import { startTheme } from '@/lib/prefs'
import { queryClient } from '@/lib/query-client'
import { loginUrl } from '@/lib/safe-next'
import './index.css'

startTheme()
const router = createRouter()
const i18n = createStaffI18n() // English only (ADR-0018); @noor/ui components still read their labels from here

// a 401 anywhere: forget the session and go to sign-in, remembering the page
sessionEvents.addEventListener('unauthenticated', () => {
  setCsrfToken('')
  queryClient.clear()
  const { pathname, search } = router.state.location
  if (!pathname.startsWith('/login')) void router.navigate(loginUrl(pathname + search, true), { replace: true })
})

createRoot(/** @type {HTMLElement} */ (document.getElementById('root'))).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <DirectionProvider direction="ltr">
          <RouterProvider router={router} />
        </DirectionProvider>
      </I18nextProvider>
    </QueryClientProvider>
  </StrictMode>,
)
