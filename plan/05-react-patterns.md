# 05 — React Patterns

| Field | Value |
|---|---|
| ID | DOC-05 |
| Title | React patterns: where to use each in our code, where not to, with samples |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03, DOC-04b, DOC-04c |
| Decisions used | ADR-0002, ADR-0004, ADR-0005, ADR-0013, ADR-0015, ADR-0020 |

## 1. Purpose and scope

**Governs:** how React code is written in `apps/admin`, `apps/storefront` and `packages/ui`: one approved pattern per problem, with its limits.
**Does not govern:** folder placement (DOC-03), component APIs (DOC-04b), test strategy (DOC-13).

Each section has the same shape: **Use it for**, **Do not use it for**, **Sample**. Paths in "Use it for" are the real places in this codebase.

## 2. Virtualization (TanStack Virtual)

**Use it for:** admin table bodies whose page can exceed 100 rows: products (`features/products/components/ProductTable.tsx`), orders, customers, audit log, the variant matrix in the product editor (a 6 × 8 option grid is 48 rows; a bundle can exceed 100), and `Combobox` lists over 200 options (cities).
**Do not use it for:** anything on the storefront (lists there are paginated at 24 and must be in the server HTML for SEO); admin lists at the default page size of 50; lists whose rows have unknown, changing heights and fewer than 100 items.

```tsx
// apps/admin/src/components/VirtualRows.tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

export function VirtualRows<T>({ rows, rowHeight = 44, render }: { rows: T[]; rowHeight?: number; render: (row: T, i: number) => ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 10 })
  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((item) => (
          <div key={item.key} style={{ position: 'absolute', insetBlockStart: item.start, insetInline: 0, height: item.size }}>
            {render(rows[item.index]!, item.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Rules: fixed row height (44 px) wherever possible; the scroll container has a fixed max height; `aria-rowcount` is set on the table so screen readers know the real size; keyboard focus on a row survives scrolling (focused row index kept in state).

## 3. Forms: Zod + React Hook Form

**Use it for:** every form with more than one field: storefront checkout (`features/checkout/components/CheckoutForm.tsx`), track order, admin product editor, order dispatch dialog, settings.
**Do not use it for:** a single search box or a quantity stepper (plain controlled state or the URL); storefront forms that work without JavaScript and have no client validation need (newsletter: a plain `<Form method="post">`).

The schema comes from `@noor/contract`. A form-only schema may **extend or refine** a contract schema; it never redefines it.

```tsx
// apps/storefront/app/features/checkout/components/CheckoutForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateOrderBody, type z } from '@noor/contract'
import { useFetcher } from 'react-router'

const FormSchema = CreateOrderBody.omit({ expectedTotal: true }) // added by the action from the last quote; the cart comes from the cookie
type FormValues = z.infer<typeof FormSchema>

export function CheckoutForm({ defaults }: { defaults: Partial<FormValues> }) {
  const fetcher = useFetcher<{ issues?: { path: string; code: string }[] }>()
  const form = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: defaults, mode: 'onBlur', reValidateMode: 'onChange' })

  // server field errors → fields (an effect: it synchronises the form library with a server response)
  useEffect(() => {
    for (const issue of fetcher.data?.issues ?? []) form.setError(issue.path as never, { message: issue.code })
  }, [fetcher.data, form])

  return (
    <form onSubmit={form.handleSubmit((values) => fetcher.submit(values, { method: 'post', encType: 'application/json' }))} noValidate>
      <RHFField control={form.control} name="customer.name" label={t('checkout.name')}>
        {(field) => <Input {...field} autoComplete="name" />}
      </RHFField>
      {/* … */}
      <Button type="submit" loading={fetcher.state !== 'idle'}>{t('checkout.submit')}</Button>
    </form>
  )
}
```

`RHFField` (in `@noor/ui/field`) wraps `Field` + `Controller`, passes `invalid`, and translates the error code with `t('errors.' + code)`.

Rules:
- `mode: 'onBlur'`, `reValidateMode: 'onChange'` everywhere (DOC-04c §3).
- Error messages are **codes**, translated at render. Zod custom messages are codes too: `z.string().min(1, 'required')`.
- Money fields hold `Money`, never a number of rupees (ADR-0013).
- Dynamic lists (variants, components, size-chart rows) use `useFieldArray` with the row's `id` as key.
- The admin product editor is one `useForm` for the whole product; sections read slices with `useWatch({ name })`, not `watch()` at the top (which re-renders everything).
- The submit handler sends exactly what the schema produced; no hand-built payloads.

## 4. Memoization and the React Compiler

The compiler (`babel-plugin-react-compiler`) is on in all three React workspaces. It memoizes components and hooks that follow the Rules of React.

**Use manual `useMemo` / `useCallback` / `memo` only for:**
1. A value passed to a non-React API that needs a stable identity across renders and that the compiler cannot see through: TanStack Table `columns` and `data` (define columns at module scope; `data` comes from the query result, which is already stable).
2. A dependency of `useEffect` that must not retrigger it, when restructuring is not possible.
3. A measured problem: a React DevTools profile attached to the PR showing the win.

**Do not use them for:** "just in case"; inline event handlers; derived values that are cheap (filtering 50 rows).

Opt-outs: `'use no memo'` at the top of a function is allowed only with a comment naming the reason and a linked issue. `eslint-plugin-react-hooks` (v7, already installed) reports compiler bail-outs; treat them as errors to fix, not to silence.

```tsx
// good: columns are static, defined once at module scope
const columns = [/* … */]
export function ProductTable({ rows }: { rows: ProductSummary[] }) { /* useTable({ columns, data: rows }) */ }

// bad: new array each render, table re-initialises
export function ProductTable({ rows }) { const columns = [/* … */]; /* … */ }
```

What the compiler does not fix, so the code must: state placed too high (lift state only as far as needed), context values that change on every keystroke (split the context or use a selector store), and rendering 2,000 rows (virtualize, §2).

## 5. Refs

**Use it for:** focusing the first invalid field or a dialog's primary control; measuring an element (virtualizer scroll container, carousel); holding a timer or `AbortController`; integrating a non-React widget.
**Do not use it for:** values that affect rendering (that is state); reading or writing a ref during render; passing a ref to "call a method" on a child (lift the state or pass a callback instead).

React 19: `ref` is a normal prop; **no `forwardRef` in new code**. Ref callbacks may return a cleanup function.

```tsx
export function Input({ ref, className, ...props }: ComponentProps<'input'>) {
  return <input ref={ref} className={cn('h-(--control-h) rounded-control border border-line-strong bg-surface px-3', className)} {...props} />
}

// measuring with cleanup
<div ref={(el) => { if (!el) return; const ro = new ResizeObserver(onResize); ro.observe(el); return () => ro.disconnect() }} />
```

## 6. Compound components

**Use it for:** `@noor/ui` components whose parts need flexible arrangement: `Dialog` (`Dialog.Trigger`, `Dialog.Content`, `Dialog.Footer`), `Tabs`, `Accordion`, `Menu`, `Table`; storefront `Gallery` (`Gallery.Main`, `Gallery.Thumbs`); admin `DataTable` (`DataTable.Toolbar`, `DataTable.Body`, `DataTable.Pagination`).
**Do not use it for:** components with one sensible layout (`Button`, `Price`, `Badge`); app features where a props object is clearer. If a component is used with the same parts in the same order three times, add a convenience prop API on top (as `Dialog` has `title`/`footer` props for the common case).

```tsx
const TabsCtx = createContext<{ value: string; set: (v: string) => void } | null>(null)
const useTabs = () => { const c = use(TabsCtx); if (!c) throw new Error('Tabs.* must be inside <Tabs>'); return c }

export function Tabs({ value, onValueChange, children }: Props) {
  return <TabsCtx value={{ value, set: onValueChange }}>{children}</TabsCtx>
}
Tabs.Tab = function Tab({ value, children }: { value: string; children: ReactNode }) {
  const t = useTabs()
  return <button role="tab" aria-selected={t.value === value} onClick={() => t.set(value)}>{children}</button>
}
```

(React 19: `<Context value>` instead of `<Context.Provider>`; `use(Context)` instead of `useContext`.) In practice Base UI already provides the compound parts; our wrappers re-export them styled.

## 7. Suspense and lazy loading

**Use it for:**
- Admin: every route is lazy (`lazy: () => import('./routes/orders')` in `app/router.tsx`); heavy editors loaded on demand inside a page (rich-text editor in CMS pages, the size-chart grid, charts on the dashboard) with `React.lazy` + `<Suspense fallback={<Skeleton …/>}>`.
- Storefront: route modules are split by the framework. Below-the-fold data is **deferred**: the loader returns a promise without awaiting it, and the component renders it with `<Suspense>` + `<Await>` (reviews, "you may also like", recently viewed).

**Do not use it for:** above-the-fold storefront content (title, price, gallery, add-to-cart must be in the first HTML); splitting a component under about 10 kB; wrapping the whole app in one `Suspense` (one slow part blanks everything).

```tsx
// apps/storefront/app/routes/product.tsx
export async function loader({ params, request }: Route.LoaderArgs) {
  const product = await getProduct(params.handle, request)        // awaited: needed for first paint and <title>
  const related = getRelated(product.id, request)                 // NOT awaited: streamed
  return { product, related }
}

export default function ProductRoute({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <ProductDetail product={loaderData.product} />
      <Suspense fallback={<ProductGridSkeleton count={4} />}>
        <Await resolve={loaderData.related} errorElement={null}>
          {(items) => <RelatedProducts items={items} />}
        </Await>
      </Suspense>
    </>
  )
}
```

Rules: every `Suspense` has a skeleton matching the final size; every lazy route has an `ErrorBoundary` (a failed chunk load shows `ErrorState` with a reload button); a deferred section that fails renders nothing and logs.

## 8. Transitions

**Use it for:** keeping the UI responsive while something non-urgent updates: admin search box filtering a table (`useDeferredValue` on the query text), switching tabs whose panel is lazy (`startTransition`), storefront filter changes that navigate (`useNavigation().state` drives a pending style on the grid).
**Do not use it for:** controlled input values themselves (typing must be urgent); hiding a slow render that should be fixed by virtualization or pagination.

```tsx
// admin: search-as-you-type
const [text, setText] = useState(initial)
const deferred = useDeferredValue(text)
const query = useQuery(productQueries.list({ ...filters, q: deferred }))
const stale = text !== deferred || query.isFetching
return (<><Input value={text} onChange={(e) => setText(e.target.value)} /><div className={stale ? 'opacity-60' : ''}>…</div></>)

// storefront: pending state for a filter navigation
const nav = useNavigation()
<div aria-busy={nav.state === 'loading'} className={nav.state === 'loading' ? 'opacity-60 transition-opacity' : ''}><ProductGrid … /></div>
```

The admin also debounces the URL update by 300 ms (DOC-04c §7) so each keystroke is not a history entry (`setSearchParams(next, { replace: true })`).

## 9. Optimistic updates

**Use it for:** actions that almost always succeed and whose result is obvious: storefront wishlist toggle, cart quantity change, cart line removal; admin toggles (product active/draft switch, review approve), reordering (menu items, media).
**Do not use it for:** anything involving money or stock as the source of truth: **placing an order, applying a promo code, cart totals** (the server computes them, ADR-0020; show a pending state and wait); deletes that cannot be undone; bulk actions.

Storefront (React 19 `useOptimistic` + fetcher):
```tsx
function QuantityCell({ line }: { line: CartLine }) {
  const fetcher = useFetcher()
  const [qty, setOptimisticQty] = useOptimistic(line.quantity)
  return (
    <QuantityStepper value={qty} max={line.available} onValueChange={(next) => {
      startTransition(async () => {
        setOptimisticQty(next)                                   // quantity updates instantly
        await fetcher.submit({ intent: 'setQty', lineId: line.id, quantity: next }, { method: 'post', action: '/cart' })
      })
    }} />
  )
}
// Line total and cart total come from loader data after revalidation; while pending they render at 60% opacity.
```

Admin (TanStack Query):
```ts
export function useSetProductStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; status: ProductStatus }) =>
      api('admin.products.bulk', { body: { action: v.status === 'active' ? 'publish' : 'unpublish', ids: [v.id] } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: productKeys.detail(v.id) })
      const prev = qc.getQueryData(productKeys.detail(v.id))
      qc.setQueryData(productKeys.detail(v.id), (p: Product | undefined) => p && { ...p, status: v.status })
      return { prev }
    },
    onError: (_e, v, ctx) => { qc.setQueryData(productKeys.detail(v.id), ctx?.prev); toast.push({ tone: 'danger', title: 'Status not changed' }) },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: productKeys.all }),
  })
}
```

Every optimistic update has a rollback and tells the user when it rolls back (DOC-04c §5).

## 10. TanStack Query: keys, options, invalidation (admin only)

**Use it for:** all server state in the admin.
**Do not use it for:** the storefront (loaders); form state; UI state; data already in the URL.

One file per feature, `features/<name>/api.ts`, exporting a key factory, `queryOptions` builders and mutation hooks. Components never write a key by hand.

```ts
// apps/admin/src/features/products/api.ts
import { queryOptions, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (f: ProductFilters) => [...productKeys.lists(), f] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export const productQueries = {
  list: (f: ProductFilters) => queryOptions({
    queryKey: productKeys.list(f),
    queryFn: ({ signal }) => api('admin.products.list', { query: f, signal }),
    placeholderData: keepPreviousData,       // old page stays visible while the next loads
  }),
  detail: (id: string) => queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: ({ signal }) => api('admin.products.get', { params: { id }, signal }),
  }),
}
```

Client defaults (`lib/query-client.ts`):

| Option | Value | Why |
|---|---|---|
| `staleTime` | 30 s | Staff tabs stay open; avoids refetch on every focus |
| `gcTime` | 5 min | Default |
| `retry` | Queries: 2, only for network errors and 5xx. Mutations: 0 | Never auto-retry a write |
| `refetchOnWindowFocus` | `true` | Orders change while the tab is in the background |
| `refetchInterval` | Off globally; orders list 60 s while visible | New-order awareness without websockets |

Invalidation table (a mutation invalidates by **prefix**, never by guessing exact keys):

| Mutation | Invalidates |
|---|---|
| Create / update / delete / bulk product | `productKeys.all`, `['dashboard']` |
| Change category tree, attributes, sizes, collections | that feature's `all`, `productKeys.lists()` |
| Order transition, note, dispatch | `orderKeys.all`, `['dashboard']`, `['inventory']` |
| Promo create / update | `promoKeys.all` |
| Settings / appearance / shipping | that feature's `all` |
| Staff / role change | `staffKeys.all`, `['me']` |
| Any mutation returning the updated entity | Also `setQueryData(detail(id), result)` so the detail view updates without a round trip |

A 401 from any query clears the cache and redirects to `/login`. A 403 shows `ErrorState` "You do not have access" (DOC-11 owns the role matrix).

## 11. Other fixed choices

| Topic | Rule |
|---|---|
| Effects | `useEffect` is for synchronising with something outside React (a subscription, a timer, the document title in the admin). Never for fetching, never for deriving state from props |
| Derived state | Compute during render. No `useState` + `useEffect` mirroring a prop |
| Keys | Stable ids from data; never the array index for a list that can reorder, insert or delete |
| Context | For dependency injection of rarely changing values (direction, toast API, current user). Not a store for frequently changing state |
| Zustand (storefront) | One store, `features/cart/store.ts`: `{ drawerOpen, open(), close() }`. Selected with selectors (`useCartUi((s) => s.drawerOpen)`). Server data never goes in it |
| Error boundaries | One per route (framework `ErrorBoundary` export) plus one around each independently failing widget (dashboard cards) |
| Events | Handlers are named `handleX` inside a component and `onX` as props |
| Conditional rendering | `cond ? <A/> : null`; never `count && <A/>` (renders `0`) |
| Dates and money | Only through `@noor/i18n` formatters |
| IDs for a11y | `useId()`; never a hand-written id string |
| SSR safety (storefront) | No `window`/`document`/`localStorage` during render; browser-only code goes in an effect or an event handler |

## 12. Rules

**Always:** take schemas and types from `@noor/contract`; keep list state in the URL; give every optimistic update a rollback; attach a profile when adding manual memoization.
**Never:** fetch in `useEffect`; copy server data into `useState`; compute a price, discount, shipping fee or stock figure in the client as truth; use `forwardRef`, `useContext` or `<Context.Provider>` in new code; use `any`.
**Common mistakes:** `watch()` at the top of a large form; defining table columns inside the component; awaiting everything in a storefront loader (blocks first byte on the slowest call); invalidating an exact key and missing the other filtered lists.

## 13. Acceptance checklist

- [x] `grep -rnE "useEffect\([^)]*fetch|forwardRef|useContext\(" apps packages` returns nothing in new code. (Run at M7-07 (the one `useContext` became `use`).)
- [ ] Every `features/*/api.ts` in the admin exports a key factory; `grep -rn "queryKey: \[" apps/admin/src --include=*.tsx` returns nothing (keys only come from factories). **Open: the main areas have key factories, but four private keys remain (`bulk-bar` job, `command-palette`, `history-panel`, `link-input`).**
- [ ] Every `useMemo`/`useCallback`/`memo` has a comment citing case 1, 2 or 3 of §4. **Open: four `useMemo` uses; not all carry the comment.**
- [x] Storefront PDP HTML (curl, no JS) contains title, price and the add-to-cart form. (`apps/storefront/test/shell.server.test.js` ("server HTML: heading, the price, the options, a form that posts to the cart") and E2E-02.)
- [ ] Throttled to "Slow 4G", changing a cart quantity updates the number immediately and the total after the response. **Open: manual, needs a throttled browser.**

## 14. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-05-1 | TanStack Table v9 hook and option names | Partly resolved in Phase 3: `useTable` + `tableFeatures` confirmed from the v9 announcement; `DataTable` is specified in DOC-07.14 behind its own props | First `DataTable` build |
| Q-05-2 | React Router 8 typegen names (`Route.LoaderArgs`, `Route.ComponentProps`) and `Await` | Same as v7 framework mode | First storefront route at M1 |
| Q-05-3 | `fetcher.submit` returning a promise inside `startTransition` | Supported since v7 | Same |

## 15. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 1) |
| 2026-10-02 | Phase 3: Q-05-1 updated (DOC-07.14) |
| 2026-10-02 | Phase 7 consistency review: samples use real route keys and the final order body |
