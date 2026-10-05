import { useEffect } from 'react'
import { usePersistentState } from './usePersistentState.js'

// 'system' | 'light' | 'dark' — persisted under admin:ui-theme, defaulting to
// prefers-color-scheme on first load, same pattern as every other persisted
// UI preference in this codebase (see hooks/usePersistentState.js).
export function useTheme() {
  const [theme, setTheme] = usePersistentState('ui-theme', 'system')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  const resolved = theme === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  const toggle = () => setTheme(resolved === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, resolved, toggle }
}
