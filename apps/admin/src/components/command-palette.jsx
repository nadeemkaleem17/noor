import { formatMoney } from '@noor/i18n/format'
import { Dialog } from '@noor/ui/dialog'
import { useQuery } from '@tanstack/react-query'
import { Box, Command, CornerDownLeft, Package, ShoppingBag, User } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useNavCounts } from '@/lib/nav-counts'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { screens } from '@/lib/screens'
import { useCan, useLogout } from '@/lib/session'
import { formatKeys, liveShortcuts } from '@/lib/shortcuts'
import { useDebounced } from '@/lib/use-debounced'

/** @typedef {{ id: string; section: 'Recent' | 'Go to' | 'Actions' | 'Orders' | 'Products' | 'Customers'; label: string; detail?: string; keys?: string; href?: string; run?: () => void; icon: import('react').ReactNode }} Item */

const RECENT_KEY = 'noor.admin.recent'
const icons = { order: <ShoppingBag aria-hidden className="size-4" />, product: <Package aria-hidden className="size-4" />, customer: <User aria-hidden className="size-4" />, go: <Box aria-hidden className="size-4" />, action: <Command aria-hidden className="size-4" /> }

/** The five things opened from the palette most recently, kept for this visit only. */
function recent() {
  try {
    return /** @type {Item[]} */ (JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]')).slice(0, 5)
  } catch {
    return []
  }
}
/** @param {{ id: string; label: string; detail?: string; href: string; kind: 'order' | 'product' | 'customer' }} r */
function remember(r) {
  try {
    const rest = recent().filter((x) => x.id !== r.id)
    sessionStorage.setItem(RECENT_KEY, JSON.stringify([{ id: r.id, section: 'Recent', label: r.label, detail: r.detail, href: r.href, icon: null, kind: r.kind }, ...rest].slice(0, 5)))
  } catch {
    // storage blocked: the list of recent things is just empty
  }
}

const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en', { showDecimals: false, rounding: 'none' }).replace(/\s/g, ' ')
const human = (/** @type {string} */ v) => v.replace(/_/g, ' ')

/**
 * Mod K: where to go, what to do, and a search of orders, products and customers (plan/07-admin/15-shortcuts.md section 6). What it offers is what the person may use: the menu by permission,
 * the actions by permission, the results by what the server gives their role. Arrow keys move, Enter opens, Mod Enter opens in a new tab, Escape closes.
 * @param {{ open: boolean; onClose: () => void }} props
 */
export function CommandPalette({ open, onClose }) {
  if (!open) return null
  return <Palette onClose={onClose} />
}

/** @param {{ onClose: () => void }} props */
function Palette({ onClose }) {
  const navigate = useNavigate()
  const can = useCan()
  const counts = useNavCounts()
  const logout = useLogout()
  const { theme } = usePrefs()
  const listId = useId()
  const [text, setText] = useState('')
  const [at, setAt] = useState(0)
  const q = useDebounced(text.trim(), 250)
  const searching = q.length >= 2
  const found = useQuery({ queryKey: ['palette', q], queryFn: ({ signal }) => api('admin.search', { query: { q }, signal }), enabled: searching, retry: false, staleTime: 30_000 })

  const items = useMemo(() => {
    const needle = text.trim().toLowerCase()
    const hit = (/** @type {string} */ s) => !needle || s.toLowerCase().includes(needle)
    /** @type {Item[]} */
    const out = []
    if (!needle) out.push(...recent().map((r) => ({ ...r, icon: icons[/** @type {'order' | 'product' | 'customer'} */ (/** @type {any} */ (r).kind)] ?? icons.go })))
    if (searching && found.data) {
      const digits = needle.replace(/^rb-?/, '')
      // an order number typed whole comes first
      const orders = [...found.data.orders].sort((a, b) => Number(b.orderNumber.replace(/\D/g, '') === digits) - Number(a.orderNumber.replace(/\D/g, '') === digits))
      for (const o of orders) out.push({ id: `o${o.id}`, section: 'Orders', label: `${o.orderNumber} ${o.customerName}`, detail: `${human(o.status)} · ${money(o.total)}`, href: `/orders/${o.id}`, icon: icons.order })
      for (const p of found.data.products) out.push({ id: `p${p.id}`, section: 'Products', label: p.title, detail: `${human(p.status)} · ${human(p.stockStatus)}${p.sku ? ` · ${p.sku}` : ''}`, href: `/products/${p.id}`, icon: icons.product })
      for (const c of found.data.customers) out.push({ id: `c${c.id}`, section: 'Customers', label: c.name, detail: `${c.city ?? ''}${c.city ? ' · ' : ''}${c.ordersCount === 1 ? '1 order' : `${c.ordersCount} orders`}`, href: `/customers/${c.id}`, icon: icons.customer })
    }
    for (const s of screens.filter((x) => x.group && (!x.permission || can(x.permission)) && (x.feature !== 'reviews' || counts?.reviewsPending !== undefined))) {
      if (hit(s.title)) out.push({ id: `g${s.path}`, section: 'Go to', label: s.title, href: s.path, icon: icons.go })
    }
    /** @type {{ label: string; ok: boolean; href?: string; run?: () => void }[]} */
    const actions = [
      { label: 'New product', ok: can('products:write'), href: '/products/new' },
      { label: 'New order', ok: can('orders:edit'), href: '/orders/new' },
      { label: 'New promo code', ok: can('promos:write'), href: '/promos?new=1' },
      { label: 'Invite staff', ok: can('staff:manage'), href: '/staff?invite=1' },
      { label: 'Toggle theme', ok: true, run: () => setPrefs({ theme: theme === 'dark' ? 'light' : 'dark' }) },
      { label: 'Sign out', ok: true, run: () => logout.mutate() },
    ]
    for (const a of actions) if (a.ok && hit(a.label)) out.push({ id: `a${a.label}`, section: 'Actions', label: a.label, href: a.href, run: a.run, icon: icons.action })
    // what the screen under the palette can do (the keys it registered)
    for (const s of liveShortcuts().filter((x) => x.group === 'This screen')) if (hit(s.label ?? '')) out.push({ id: `s${s.keys}`, section: 'Actions', label: s.label ?? s.keys, keys: s.keys, run: () => s.handler(new KeyboardEvent('keydown')), icon: icons.action })
    return out
  }, [text, searching, found.data, can, counts, theme, logout])

  const current = items[Math.min(at, Math.max(items.length - 1, 0))]
  /** @param {Item | undefined} item @param {boolean} newTab */
  function choose(item, newTab) {
    if (!item) return
    if (item.href && newTab) {
      window.open(item.href, '_blank', 'noopener')
      return
    }
    onClose()
    if (item.section === 'Orders' || item.section === 'Products' || item.section === 'Customers') remember({ id: item.id, label: item.label, detail: item.detail, href: /** @type {string} */ (item.href), kind: item.section === 'Orders' ? 'order' : item.section === 'Products' ? 'product' : 'customer' })
    if (item.href) void navigate(item.href)
    else item.run?.()
  }

  /** @type {{ section: Item['section']; items: Item[] }[]} */
  const sections = []
  for (const it of items) {
    const last = sections.at(-1)
    if (last && last.section === it.section) last.items.push(it)
    else sections.push({ section: it.section, items: [it] })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Search and commands" size="lg" description="Type to search orders, products and customers, or to find a screen or an action.">
      <div className="space-y-3">
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
          aria-label="Search and commands"
          placeholder="Order number, phone, SKU, name, or a command…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setAt(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAt((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAt((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(current, e.ctrlKey || e.metaKey)
            }
          }}
          className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-(length:--control-text) outline-none focus-visible:outline-2 focus-visible:outline-focus"
        />
        {found.isError ? <p role="alert" className="text-sm text-warning">The search is not available now. The screens and actions still work.</p> : null}
        <div id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto">
          {sections.map((s) => (
            <div key={s.section} role="group" aria-label={s.section}>
              <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted">{s.section}</p>
              {s.items.map((it) => (
                <div
                  key={it.id}
                  id={`${listId}-${it.id}`}
                  role="option"
                  aria-selected={current?.id === it.id}
                  onMouseMove={() => setAt(items.indexOf(it))}
                  onClick={(e) => choose(it, e.ctrlKey || e.metaKey)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 ${current?.id === it.id ? 'bg-accent-soft' : ''}`}
                >
                  <span className="text-muted">{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{it.label}</span>
                    {it.detail ? <span className="block truncate text-xs text-muted">{it.detail}</span> : null}
                  </span>
                  {it.keys ? <kbd className="rounded-control border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{formatKeys(it.keys)}</kbd> : null}
                  {current?.id === it.id ? <CornerDownLeft aria-hidden className="size-4 text-muted" /> : null}
                </div>
              ))}
            </div>
          ))}
          {items.length === 0 ? <p className="px-2 py-4 text-sm text-muted">{searching && found.isPending ? 'Searching…' : 'No matches.'}</p> : null}
        </div>
        <p className="text-xs text-muted">↑ ↓ to move · Enter to open · {formatKeys('mod+enter')} to open in a new tab · Esc to close</p>
      </div>
    </Dialog>
  )
}
