import { permissionModules } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { permissionLabels } from '@/lib/permission-labels'

/** @typedef {import('@noor/contract').Permission} Permission */

/**
 * The twelve modules of the admin with their permissions as tick boxes, for a base role and what is added to it and taken from it (plan/17-owner-requests-2026-10.md item 11): one person's
 * module access, and a custom role, are the same picture. A box is ticked when the result allows it; a note says whether that is the role's doing, an addition, or a removal. Nobody ticks what they
 * do not hold themselves. The parent owns the two lists.
 * @param {{ roleHas: ReadonlySet<Permission>; grants: Permission[]; revokes: Permission[]; onGrants: (v: Permission[]) => void; onRevokes: (v: Permission[]) => void; editable: boolean; mine: ReadonlySet<Permission>; who: string }} props
 * `who` is what the changes are for: "this person", "this role".
 */
export function ModuleMatrix({ roleHas, grants, revokes, onGrants, onRevokes, editable, mine, who }) {
  /** Does the result allow it, with the changes on screen? @param {Permission} p */
  const has = (p) => (roleHas.has(p) && !revokes.includes(p)) || grants.includes(p)
  /** @param {Permission} p @param {boolean} on */
  function set(p, on) {
    if (roleHas.has(p)) onRevokes(on ? revokes.filter((x) => x !== p) : [...revokes, p])
    else onGrants(on ? [...grants, p] : grants.filter((x) => x !== p))
  }
  /** Switch a whole module off or back to the base role. @param {readonly Permission[]} list @param {'off' | 'role'} how */
  function module_(list, how) {
    if (how === 'off') {
      onRevokes([...new Set([...revokes, ...list.filter((p) => roleHas.has(p))])])
      onGrants(grants.filter((p) => !list.includes(p)))
    } else {
      onRevokes(revokes.filter((p) => !list.includes(p)))
      onGrants(grants.filter((p) => !list.includes(p)))
    }
  }
  return (
    <div className="space-y-4">
      {permissionModules.map((m) => {
        const list = /** @type {readonly Permission[]} */ (m.permissions)
        const n = list.filter(has).length
        return (
          <fieldset key={m.id} className="rounded-card border border-line p-3">
            <legend className="flex flex-wrap items-center gap-2 px-1 font-medium">
              {m.label}
              <Badge tone={n === 0 ? 'neutral' : n === list.length ? 'success' : 'accent'}>{n === 0 ? 'No access' : n === list.length ? 'Full access' : `${n} of ${list.length}`}</Badge>
            </legend>
            <ul className="grid gap-1 sm:grid-cols-2">
              {list.map((p) => {
                const note = grants.includes(p) ? `added for ${who}` : revokes.includes(p) ? 'taken away' : roleHas.has(p) ? 'from the role' : ''
                // nobody gives what they do not hold themselves
                const mayChange = editable && (roleHas.has(p) || has(p) || mine.has(p))
                return (
                  <li key={p}>
                    <Checkbox label={<span>{permissionLabels[p]}{note ? <span className="ms-1 text-xs text-muted">({note})</span> : null}</span>} checked={has(p)} disabled={!mayChange} onCheckedChange={(on) => set(p, on === true)} />
                  </li>
                )
              })}
            </ul>
            {editable ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => module_(list, 'off')}>
                  Take away all of {m.label.split(',')[0]?.toLowerCase()}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => module_(list, 'role')}>
                  Back to the role
                </Button>
              </div>
            ) : null}
          </fieldset>
        )
      })}
    </div>
  )
}
