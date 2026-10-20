import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { useToast } from '@noor/ui/toast'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { BulkBar, FailuresDialog, failureReason } from './bulk-bar'

/**
 * Choosing rows of a plain table and deleting them together, with the same bar, the same confirmation and the same report as a `DataTable` (which has this built in).
 * The caller draws a checkbox in each row from `isSelected` and `toggle`, and puts `bar` above the table and `dialogs` anywhere.
 * @param {object} options
 * @param {import('@/lib/bulk-delete').BulkDeleteRoute} options.route
 * @param {[string, string]} options.noun - "subcategory", "subcategories"
 * @param {(id: string) => string} options.nameOf - what the row is called, for the confirmation and the report
 * @param {readonly (readonly unknown[])[]} options.refresh - the query keys to fetch again afterwards
 */
export function useBulkDelete({ route, noun, nameOf, refresh }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [ids, setIds] = useState(/** @type {string[]} */ ([]))
  const [asking, setAsking] = useState(false)
  const [failures, setFailures] = useState(/** @type {{ label: string; reason: string }[] | null} */ (null))
  const word = (/** @type {number} */ n) => noun[n === 1 ? 0 : 1]

  /** @param {string[]} all */
  const setAll = (all) => setIds(all)
  const toggle = (/** @type {string} */ id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function run() {
    try {
      const result = await api(route, { body: { ids } })
      const list = result.failed.map((f) => ({ label: nameOf(f.id), reason: failureReason(f) }))
      if (!list.length) toast.push({ title: `${result.succeeded.length} ${word(result.succeeded.length)} deleted`, tone: 'success' })
      else if (!result.succeeded.length) setFailures(list)
      else toast.push({ title: `${result.succeeded.length} deleted, ${list.length} not`, tone: 'warning', action: { label: 'View', onClick: () => setFailures(list) } })
      // what went leaves the selection; what could not go stays chosen
      setIds(result.failed.map((f) => f.id))
      await Promise.all(refresh.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })))
    } catch (e) {
      toast.push({ title: messageFor(e), tone: 'danger' })
      throw e
    }
  }

  const names = ids.slice(0, 5).map(nameOf)
  return {
    count: ids.length,
    isSelected: (/** @type {string} */ id) => ids.includes(id),
    toggle,
    setAll,
    clear: () => setIds([]),
    bar: ids.length ? (
      <BulkBar count={ids.length} allMatching={false} actions={[{ id: 'delete', label: 'Delete selected', destructive: true, run: async () => ({ cancelled: true }) }]} onRun={() => setAsking(true)} onClear={() => setIds([])} />
    ) : null,
    dialogs: (
      <>
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={`Delete ${ids.length} ${word(ids.length)}?`}
          body={`${names.join(', ')}${ids.length > names.length ? ` and ${ids.length - names.length} more` : ''}. This cannot be undone. One that is still in use is kept, and you are told why.`}
          confirmLabel="Delete"
          confirmText={ids.length > 20 ? String(ids.length) : undefined}
          onConfirm={run}
        />
        <FailuresDialog failures={failures} onClose={() => setFailures(null)} />
      </>
    ),
  }
}
