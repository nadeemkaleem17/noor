import { useEffect, useMemo, useState } from 'react'
import { STORE_CONFIG } from '../data/mockData'
import { apiEnabled, apiGet } from '../utils/api'
import { StoreConfigContext } from './storeConfig'

// Read-only store configuration. The admin project owns it (doc 03 §8); the storefront never writes it.
// Base values come from mockData's STORE_CONFIG; when VITE_API_URL is set, GET /api/public/settings
// overrides the parts the API provides (title, logo, favicon, hero slides). Phone, email and theme
// are not served by the API yet, so they keep their mock values.

const str = (v) => (typeof v === 'string' ? v.trim() : '')

function fromSettings(settings) {
  const slides = Array.isArray(settings?.heroSlides) ? settings.heroSlides : []
  return {
    ...(str(settings?.siteTitle) && { storeName: str(settings.siteTitle) }),
    logoUrl: str(settings?.logoUrl),
    faviconUrl: str(settings?.faviconUrl),
    heroSlides: slides
      .filter((s) => s && str(s.imageUrl) && str(s.heading))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }
}

function setFavicon(href) {
  let link = document.querySelector('link[rel~="icon"]')
  if (!link) {
    link = Object.assign(document.createElement('link'), { rel: 'icon' })
    document.head.appendChild(link)
  }
  link.removeAttribute('type') // the default favicon is typed as SVG; an uploaded one may not be
  link.href = href
}

// status: 'ready' | 'loading' | 'error' (on error the mock config stays in place)
export function StoreConfigProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState(apiEnabled ? 'loading' : 'ready')

  useEffect(() => {
    if (!apiEnabled) return
    const controller = new AbortController()
    apiGet('/api/public/settings', { signal: controller.signal })
      .then((data) => { setSettings(fromSettings(data)); setStatus('ready') })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [])

  const value = useMemo(
    () => ({ logoUrl: '', faviconUrl: '', heroSlides: [], ...STORE_CONFIG, ...settings, status }),
    [settings, status]
  )

  useEffect(() => {
    if (value.status === 'loading') return
    document.title = value.storeName
  }, [value.storeName, value.status])

  useEffect(() => {
    if (value.faviconUrl) setFavicon(value.faviconUrl)
  }, [value.faviconUrl])

  return <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>
}
