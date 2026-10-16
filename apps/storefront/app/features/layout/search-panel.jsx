import { Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Price } from '@noor/ui/price'
import { useLocalePath, useShell } from './use-shell'

/** @typedef {import('@noor/contract').Suggestions} Suggestions */
/** @typedef {{ id: string, href: string, label: string }} Option */

const RECENT_KEY = 'nc_recent_searches'
const RECENT_MAX = 6

/** The searches this browser made, newest first. Storage can be missing or full (a private window): then there are none. @returns {string[]} */
function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((q) => typeof q === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}
/** @param {string[]} list */
function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // nothing to do: the list is a convenience
  }
}
/** The words as the cache and the list know them: lower case, one space between words. @param {string} q */
const normal = (q) => q.trim().toLowerCase().replace(/\s+/g, ' ')

const sectionTitle = 'px-4 pt-3 pb-1 text-caption font-medium uppercase tracking-[0.08em] text-muted'
const optionClass = 'flex items-center gap-3 px-4 py-2 text-fg aria-selected:bg-surface-2 hover:bg-surface-2'

/**
 * The search field under the header (DOC-06.11 section 5.2): while the field is empty it offers this browser's recent searches (each can be removed) and the shop's popular ones;
 * from two letters it offers a few products, the categories and collections whose name matches, and a link to every result. Arrow keys move through the list, Enter opens the chosen
 * line (or searches), Escape closes. It is a real GET form to `/search`, so pressing Enter works as it does without JavaScript. A file of its own: it is downloaded when the search button is pressed.
 * @param {{ onClose: () => void }} props
 */
export default function SearchPanel({ onClose }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const navigate = useNavigate()
  const config = useShell()?.config
  const popular = config?.popularSearches ?? []
  const priceDisplay = config?.priceDisplay
  const id = useId()
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const [active, setActive] = useState(-1)
  // what has been asked for, by the words as `normal` writes them: one answer is never asked for twice
  const [answers, setAnswers] = useState(() => /** @type {Map<string, Suggestions>} */ (new Map()))
  const key = normal(q)
  const asking = key.length >= 2

  // 150 ms after the last key the answer is asked for (one already asked for is dropped, and one seen before is not asked again)
  const seen = answers.get(key)
  useEffect(() => {
    if (!asking || seen) return
    const ctl = new AbortController()
    const timer = setTimeout(() => {
      fetch(path(`/search/suggest?q=${encodeURIComponent(key)}`), { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : undefined))
        .then((data) => {
          if (data) setAnswers((m) => new Map(m).set(key, data))
        })
        .catch(() => {})
    }, 150)
    return () => {
      clearTimeout(timer)
      ctl.abort()
    }
  }, [asking, seen, key, path])

  const found = asking ? seen : undefined
  /** @type {Option[]} */
  const options = []
  if (!asking) {
    for (const w of recent) options.push({ id: 'r', href: path(`/search?q=${encodeURIComponent(w)}`), label: w })
    for (const w of popular) options.push({ id: 'p', href: path(`/search?q=${encodeURIComponent(w)}`), label: w })
  } else if (found) {
    for (const p of found.products) options.push({ id: 'product', href: path(`/p/${p.handle}`), label: p.title })
    for (const c of found.categories) options.push({ id: 'category', href: path(`/c/${c.handle}`), label: c.name })
    for (const c of found.collections) options.push({ id: 'collection', href: path(`/collections/${c.handle}`), label: c.title })
    if (found.total > 0) options.push({ id: 'all', href: path(`/search?q=${encodeURIComponent(q.trim())}`), label: t('shell.suggest.seeAll', { count: found.total, q: q.trim() }) })
  }
  const optionId = (/** @type {number} */ i) => `${id}-o${i}`
  /** Where the next line sits in the list: each line has its id (for `aria-activedescendant`) and its "selected" state, in the order of `options`. */
  let at = 0

  /** @param {string} term */
  const remember = (term) => {
    const w = term.trim()
    if (w.length < 2) return
    const next = [w, ...recent.filter((r) => normal(r) !== normal(w))].slice(0, RECENT_MAX)
    setRecent(next)
    writeRecent(next)
  }
  /** @param {string} term */
  const forget = (term) => {
    const next = recent.filter((r) => r !== term)
    setRecent(next)
    writeRecent(next)
  }

  const status = asking ? (found ? t('shell.suggest.count', { count: found.total, q: q.trim() }) : '') : ''

  const row = () => {
    const i = at++
    return { id: optionId(i), selected: i === active }
  }

  return (
    <div className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <form
          role="search"
          method="get"
          action={path('/search')}
          className="flex gap-2"
          onSubmit={(e) => {
            const chosen = options[active]
            if (chosen) {
              e.preventDefault()
              if (chosen.id === 'r' || chosen.id === 'p') remember(chosen.label)
              onClose()
              navigate(chosen.href)
            } else {
              remember(q)
            }
          }}
        >
          <label className="sr-only" htmlFor={`${id}-q`}>
            {t('shell.searchLabel')}
          </label>
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={`${id}-list`}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoFocus
            required
            minLength={2}
            maxLength={80}
            value={q}
            placeholder={t('shell.searchPlaceholder')}
            className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3"
            onChange={(e) => {
              setQ(e.target.value)
              setActive(-1)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!options.length) return
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : -1
                // -1 is "no line chosen": the field itself
                setActive((a) => {
                  const next = a + step
                  return next < -1 ? options.length - 1 : next >= options.length ? -1 : next
                })
              }
            }}
          />
          <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">
            {t('shell.searchSubmit')}
          </button>
          <button type="button" aria-label={t('shell.suggest.close')} className="grid size-(--control-h) place-items-center rounded-control hover:bg-surface-2" onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </button>
        </form>
        <p role="status" className="sr-only">
          {status}
        </p>
        {options.length || asking ? (
          <div id={`${id}-list`} role="listbox" aria-label={t('shell.suggest.label')} className="mt-2 max-h-[70dvh] overflow-y-auto">
            {!asking ? (
              <>
                {recent.length ? (
                  <>
                    <p className={sectionTitle}>{t('shell.suggest.recent')}</p>
                    {recent.map((w) => {
                      const r = row()
                      return (
                        <div key={`r-${w}`} className="flex items-center">
                          <RouterLink role="option" id={r.id} aria-selected={r.selected} to={path(`/search?q=${encodeURIComponent(w)}`)} onClick={() => { remember(w); onClose() }} className={`${optionClass} flex-1`}>
                            <Search aria-hidden="true" className="size-4 text-muted" />
                            {w}
                          </RouterLink>
                          <button type="button" aria-label={t('shell.suggest.forget', { q: w })} className="grid size-11 place-items-center text-muted hover:text-fg" onClick={() => forget(w)}>
                            <X aria-hidden="true" className="size-4" />
                          </button>
                        </div>
                      )
                    })}
                  </>
                ) : null}
                {popular.length ? (
                  <>
                    <p className={sectionTitle}>{t('shell.suggest.popular')}</p>
                    {popular.map((w) => {
                      const r = row()
                      return (
                        <RouterLink key={`p-${w}`} role="option" id={r.id} aria-selected={r.selected} to={path(`/search?q=${encodeURIComponent(w)}`)} onClick={() => { remember(w); onClose() }} className={optionClass}>
                          <Search aria-hidden="true" className="size-4 text-muted" />
                          {w}
                        </RouterLink>
                      )
                    })}
                  </>
                ) : null}
              </>
            ) : found ? (
              <>
                {found.products.length ? <p className={sectionTitle}>{t('shell.suggest.products')}</p> : null}
                {found.products.map((p) => {
                  const r = row()
                  return (
                    <RouterLink key={p.id} role="option" id={r.id} aria-selected={r.selected} to={path(`/p/${p.handle}`)} onClick={onClose} className={optionClass}>
                      <img src={p.primaryImage.src} srcSet={p.primaryImage.srcset} sizes="48px" alt="" width={48} height={64} loading="lazy" className="h-16 w-12 shrink-0 bg-surface-2 object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui">{p.title}</span>
                        <Price money={p.priceFrom} size="sm" display={priceDisplay} />
                      </span>
                    </RouterLink>
                  )
                })}
                {found.categories.length ? <p className={sectionTitle}>{t('shell.suggest.categories')}</p> : null}
                {found.categories.map((c) => {
                  const r = row()
                  return (
                    <RouterLink key={c.handle} role="option" id={r.id} aria-selected={r.selected} to={path(`/c/${c.handle}`)} onClick={onClose} className={optionClass}>
                      {c.name}
                    </RouterLink>
                  )
                })}
                {found.collections.length ? <p className={sectionTitle}>{t('shell.suggest.collections')}</p> : null}
                {found.collections.map((c) => {
                  const r = row()
                  return (
                    <RouterLink key={c.handle} role="option" id={r.id} aria-selected={r.selected} to={path(`/collections/${c.handle}`)} onClick={onClose} className={optionClass}>
                      {c.title}
                    </RouterLink>
                  )
                })}
                {found.total > 0 ? (
                  (() => {
                    const r = row()
                    return (
                      <RouterLink role="option" id={r.id} aria-selected={r.selected} to={path(`/search?q=${encodeURIComponent(q.trim())}`)} onClick={() => { remember(q); onClose() }} className={`${optionClass} font-medium underline underline-offset-4`}>
                        {t('shell.suggest.seeAll', { count: found.total, q: q.trim() })}
                      </RouterLink>
                    )
                  })()
                ) : (
                  <p className="px-4 py-3 text-small text-muted">{t('shell.suggest.none', { q: q.trim() })}</p>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
