import { Dialog } from '@noor/ui/dialog'
import { formatKeys, liveShortcuts } from '@/lib/shortcuts'

const groups = /** @type {const} */ (['Global', 'Lists', 'This screen'])

/**
 * The sheet that `?` opens: the shortcuts registered now, by group (plan/07-admin/15-shortcuts.md section 5). It reads the registrations, so it cannot list a key that does nothing or miss one that does.
 * @param {{ open: boolean; onClose: () => void }} props
 */
export function ShortcutHelp({ open, onClose }) {
  const live = open ? liveShortcuts() : []
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Keyboard shortcuts" description="Keys with a single letter work when you are not typing in a field. You can switch them off in My account." size="lg">
      <div className="space-y-5">
        {groups.map((g) => {
          const rows = live.filter((s) => s.group === g)
          return rows.length ? (
            <section key={g} aria-label={g}>
              <h3 className="mb-1 text-sm font-medium">{g}</h3>
              <dl className="divide-y divide-line text-sm">
                {rows.map((s) => (
                  <div key={s.keys + s.label} className="flex items-center justify-between gap-3 py-1.5">
                    <dt>{s.label}</dt>
                    <dd>
                      <kbd className="rounded-control border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{formatKeys(s.keys)}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null
        })}
      </div>
    </Dialog>
  )
}
