import { LayoutGrid, Square } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useHydrated } from './filters'

const KEY = 'nc_density'
const EVENT = 'nc-density'

/** @typedef {'compact' | 'roomy'} Density compact: two across on a phone, four on a desktop; roomy: one and three. */

/** @param {() => void} notify */
const subscribe = (notify) => {
  window.addEventListener(EVENT, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(EVENT, notify)
    window.removeEventListener('storage', notify)
  }
}
/** What this browser chose; storage can be missing (a private window), then the default. @returns {Density} */
function read() {
  try {
    return localStorage.getItem(KEY) === 'roomy' ? 'roomy' : 'compact'
  } catch {
    return 'compact'
  }
}

/** The grid density this browser chose for listings (DOC-06.14 LS-06). The server and the first draw use the default, so the HTML is the same for everyone. @returns {Density} */
export const useDensity = () => useSyncExternalStore(subscribe, read, () => 'compact')

/** @param {Density} next */
function choose(next) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // nothing to do: the choice lasts until the page is left
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Two buttons that change how many products sit in a row; only with JavaScript, because it is remembered in the browser. */
export function DensityToggle() {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const density = useDensity()
  if (!hydrated) return null
  return (
    <div role="group" aria-label={t('listing.density.label')} className="flex items-center">
      {/** @type {const} */ ([['compact', LayoutGrid], ['roomy', Square]]).map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={density === value}
          aria-label={t(`listing.density.${value}`)}
          className={`grid size-11 place-items-center rounded-control ${density === value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'}`}
          onClick={() => choose(value)}
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      ))}
    </div>
  )
}
