import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { deliveryPeopleQuery, useAssignOrders } from '@/lib/delivery'
import { messageFor } from '@/lib/errors'

/** Pakistan is five hours ahead of UTC all year. */
const pkToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)

/**
 * "Assign to a rider" for the orders chosen on the list (plan/18-delivery-assignment-ledger-receipts.md section 4): pick the person and the day; the answer names each order that could not go.
 * @param {{ ids: string[] | null; nameOf: (id: string) => string; onClose: () => void }} props
 */
export function AssignDialog({ ids, nameOf, onClose }) {
  const toast = useToast()
  const people = useQuery({ ...deliveryPeopleQuery, enabled: ids !== null })
  const assign = useAssignOrders()
  const [personId, setPersonId] = useState('')
  const [day, setDay] = useState(pkToday)
  const [skipped, setSkipped] = useState(/** @type {{ id: string; code: string; detail?: string }[]} */ ([]))
  const [run, setRun] = useState(/** @type {{ id: string; number: string } | null} */ (null))
  const active = (people.data?.items ?? []).filter((p) => p.active)

  function close() {
    setSkipped([])
    setRun(null)
    setPersonId('')
    onClose()
  }

  return (
    <Dialog
      open={ids !== null}
      onOpenChange={(open) => !open && close()}
      title={run ? `Given to the rider: ${run.number}` : `Assign ${ids?.length ?? 0} ${ids?.length === 1 ? 'order' : 'orders'} to a rider`}
      description={run ? undefined : 'Only confirmed orders can be given to a rider. Cash on delivery orders put their cash on the rider when the run goes out.'}
      footer={
        run ? (
          <>
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
            <Button render={<AppLink to={`/delivery/runs/${run.id}`} />}>Open the run</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={assign.isPending}
              disabled={!personId || !day}
              onClick={() =>
                assign.mutate(
                  { personId, orderIds: ids ?? [], runDate: day },
                  {
                    onSuccess: (r) => {
                      setSkipped(r.skipped)
                      if (r.runId && r.number) {
                        setRun({ id: r.runId, number: r.number })
                        toast.push({ title: `${r.assigned.length} ${r.assigned.length === 1 ? 'order' : 'orders'} given to the rider`, tone: 'success' })
                      }
                    },
                    onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }),
                  },
                )
              }
            >
              Assign
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        {run ? null : (
          <>
            <Field label="Delivery person" required hint={people.isSuccess && active.length === 0 ? 'There is nobody yet: add a rider under Delivery people.' : undefined}>
              <NativeSelect value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder="Choose a person" options={active.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
            <Field label="Day of the run" required hint="Orders for the same person and day go on one sheet.">
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
          </>
        )}
        {skipped.length ? (
          <div role="alert" className="rounded-control bg-warning-soft px-3 py-2 text-sm">
            <p className="font-medium">{skipped.length === 1 ? '1 order was not given:' : `${skipped.length} orders were not given:`}</p>
            <ul className="list-disc ps-5">
              {skipped.map((s) => (
                <li key={s.id}>{s.detail ?? `${nameOf(s.id)}: ${s.code.replaceAll('_', ' ')}`}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
