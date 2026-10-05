import { Combobox } from '@noor/ui/combobox'
import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { productQueries } from '../api'

/**
 * Chooses products by searching their title, SKU or handle (related products, the children of a set). Titles of the ones already chosen are read from the cache or the server.
 * @param {{ label: string; value: string[]; onChange: (ids: string[]) => void; max: number; excludeId?: string; }} props
 */
export function ProductPicker({ label, value, onChange, max, excludeId }) {
  const chosen = useQueries({ queries: value.map((id) => productQueries.detail(id)) })
  const known = chosen.flatMap((q) => (q.data ? [{ value: q.data.id, label: q.data.title }] : []))
  return (
    <Combobox
      multiple
      aria-label={label}
      placeholder={value.length >= max ? `Up to ${max}` : 'Search products…'}
      emptyText="No products found"
      options={known}
      value={value}
      onValueChange={(ids) => onChange(ids.slice(0, max))}
      onSearch={async (q) => {
        if (q.trim().length < 2) return known
        const { items } = await api('admin.products.list', { query: { q: q.trim(), size: 25 } })
        return [...known, ...items.filter((p) => p.id !== excludeId && !known.some((k) => k.value === p.id)).map((p) => ({ value: p.id, label: p.title }))]
      }}
    />
  )
}
