import { Input } from '@noor/ui/input'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/use-debounced'

/**
 * A link: type an address or pick one the shop offers (categories, collections, products, pages). Suggestions come from the API as the person types; the value is
 * checked by the contract's link rule where the form validates, so `javascript:` and the like are refused at entry (plan/07-admin/09-content.md section 2).
 * Use inside `RHFField`: it takes the field's props.
 * @param {Omit<import('@noor/ui/input').InputProps, 'list'> & { value: string; }} props
 */
export function LinkInput({ value, ...props }) {
  const listId = useId()
  const query = useDebounced(value.trim().startsWith('/') || value.trim().length < 2 ? '' : value.trim(), 250)
  const found = useQuery({
    queryKey: ['links', query],
    queryFn: ({ signal }) => api('admin.links.search', { query: { q: query }, signal }),
    enabled: query.length >= 2 && !/^[a-z]+:/i.test(query),
    staleTime: 30_000,
  })
  return (
    <>
      <Input {...props} value={value} list={listId} inputMode="url" autoComplete="off" spellCheck={false} placeholder="/c/women or https://…" />
      <datalist id={listId}>
        {(found.data?.items ?? []).map((t) => (
          <option key={t.href} value={t.href} label={`${t.label} (${t.type})`} />
        ))}
      </datalist>
    </>
  )
}
