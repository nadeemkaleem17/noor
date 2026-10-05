import { useSearchParams } from 'react-router'

/**
 * Which drawer a list screen has open, kept in the address so a reload or a shared link restores it (plan/07-admin/04-catalog.md section 1):
 * `?edit=<id>` edits an item, `?new=1` starts one (`?new=<parentId>` can carry a starting value).
 * @returns {{ editing: string | null; creating: string | null; isOpen: boolean; edit: (id: string) => void; create: (seed?: string) => void; close: () => void; }}
 */
export function useDrawer() {
  const [search, setSearch] = useSearchParams()
  const editing = search.get('edit')
  const creating = search.get('new')
  const go = (/** @type {Record<string, string | null>} */ patch) =>
    setSearch((current) => {
      const next = new URLSearchParams(current)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      return next
    })
  return {
    editing,
    creating,
    isOpen: editing !== null || creating !== null,
    edit: (id) => go({ edit: id, new: null }),
    create: (seed = '1') => go({ new: seed, edit: null }),
    close: () => go({ edit: null, new: null }),
  }
}
