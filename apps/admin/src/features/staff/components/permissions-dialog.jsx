import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { rolesQuery } from '../api'

/** Read-only: what each role may do, straight from the server's own matrix (plan/07-admin/12-staff-roles.md section 2). */
export function PermissionsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        View permissions
      </Button>
      {open ? <PermissionsDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** @param {{ onClose: () => void; }} props */
function PermissionsDialog({ onClose }) {
  const roles = useQuery(rolesQuery)
  const items = roles.data?.items ?? []
  const permissions = [...new Set(items.flatMap((r) => r.permissions))].sort()
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="What each role can do" footer={<Button onClick={onClose}>Close</Button>}>
      {roles.isPending ? <Spinner label="Loading roles" /> : null}
      <ul className="mb-4 space-y-2 text-sm">
        {items.map((r) => (
          <li key={r.role}>
            <strong>{r.label}</strong>: {r.summary} {r.twoFactorRequired ? <span className="text-muted">Two-step sign-in is required.</span> : null}
          </li>
        ))}
      </ul>
      {items.length > 0 ? (
        <div className="max-h-96 overflow-auto">
          <Table label="Permissions by role">
            <caption className="sr-only">Permissions by role</caption>
            <thead>
              <tr>
                <Th>Permission</Th>
                {items.map((r) => (
                  <Th key={r.role}>{r.label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p}>
                  <Td className="font-mono text-xs">{p}</Td>
                  {items.map((r) => (
                    <Td key={r.role}>{r.permissions.includes(p) ? <Check aria-label="Yes" className="size-4 text-success" /> : <span aria-label="No" className="text-muted">·</span>}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </Dialog>
  )
}
