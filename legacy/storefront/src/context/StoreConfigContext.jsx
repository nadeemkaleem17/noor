import { useEffect, useMemo, useState } from 'react'
import { STORE_CONFIG } from '../data/mockData'
import { apiEnabled, apiGet } from '../utils/api'
import { StoreConfigContext } from './storeConfig'

// Read-only store configuration. The admin project owns it (doc 03 §8); the storefront never writes it.
// Base values come from mockData's STORE_CONFIG; when VITE_API_URL is set, GET /api/public/settings
// (the admin's Site settings page) overrides title, logo, favicon, announcement bar, hero slides,
// promo banner, editorial section, footer text and contact phone/email. Theme is still mock-only.

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// A home-page block from the API, keeping only string/boolean fields (never trust the shape blindly).
function banner(v, fallback) {
  if (!isObj(v)) return fallback
  return {
    enabled: v.enabled !== false,
    eyebrow: str(v.eyebrow), heading: str(v.heading), text: str(v.text),
    buttonText: str(v.buttonText), buttonLink: str(v.buttonLink),
    ...('imageUrl' in v && { imageUrl: str(v.imageUrl) }),
  }
}

function fromSettings(settings) {
  const slides = Array.isArray(settings?.heroSlides) ? settings.heroSlides : []
  const footer = isObj(settings?.footer) ? settings.footer : {}
  return {
    ...(str(settings?.siteTitle) && { storeName: str(settings.siteTitle) }),
    logoUrl: str(settings?.logoUrl),
    faviconUrl: str(settings?.faviconUrl),
    heroSlides: slides
      .filter((s) => s && str(s.imageUrl) && str(s.heading))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    // Settings saved before these fields existed simply keep the storefront defaults.
    ...('announcement' in (settings || {}) && { announcement: str(settings.announcement) }),
    ...(isObj(settings?.promo) && { promo: banner(settings.promo, STORE_CONFIG.promo) }),
    ...(isObj(settings?.editorial) && { editorial: banner(settings.editorial, STORE_CONFIG.editorial) }),
    ...(str(footer.about) && { footerAbout: str(footer.about) }),
    ...(str(footer.phone) && { phone: str(footer.phone) }),
    ...(str(footer.email) && { email: str(footer.email) }),
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

  // Load once, then again whenever the tab regains focus, so edits saved in the admin's Site settings
  // appear on the storefront when you switch back to it. A failed re-check keeps what's on screen.
  useEffect(() => {
    if (!apiEnabled) return
    let controller = null
    let loadedOnce = false
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      apiGet('/api/public/settings', { signal })
        .then((data) => {
          const next = fromSettings(data)
          setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
          setStatus('ready')
          loadedOnce = true
        })
        .catch(() => { if (!signal.aborted && !loadedOnce) setStatus('error') })
    }
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      controller?.abort()
    }
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
