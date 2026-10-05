import { ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/form-error'
import { api } from '@/lib/api'

/** What `run` rejects with when the person closes the password dialog: nothing went wrong, so callers show nothing. */
export class StepUpCancelled extends Error {
  constructor() {
    super('step-up cancelled')
    this.name = 'StepUpCancelled'
  }
}
/** @param {unknown} error */
export const wasCancelled = (error) => error instanceof StepUpCancelled

/** @param {{ onConfirmed: () => void; onCancel: () => void; }} props */
function StepUpDialog({ onConfirmed, onCancel }) {
  const [password, setPassword] = useState('')
  const confirm = useMutation({ mutationFn: (/** @type {string} */ p) => api('admin.me.confirmPassword', { body: { password: p } }), onSuccess: onConfirmed })
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title="Confirm your password"
      description="This change needs your password again, because it is a sensitive one."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="step-up-form" loading={confirm.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <form id="step-up-form" noValidate className="space-y-3" onSubmit={(e) => (e.preventDefault(), password && confirm.mutate(password))}>
        <Field label="Your password" required>
          <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <FormError error={confirm.error} />
      </form>
    </Dialog>
  )
}

/**
 * Sensitive calls (staff changes, two-step sign-in) need the person's password when their sign-in is older than 15 minutes (plan/07-admin/12-staff-roles.md section 4).
 * `run(call)` makes the call; when the server asks for the password it shows `dialog`, confirms, and makes the call again. Render `dialog` once in the screen.
 * If the person cancels, `run` rejects with `StepUpCancelled`.
 */
export function useStepUp() {
  const [pending, setPending] = useState(/** @type {{ resolve: () => void; reject: (e: Error) => void; } | null} */ (null))
  /** @template T @param {() => Promise<T>} call @returns {Promise<T>} */
  async function run(call) {
    try {
      return await call()
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'step_up_required') throw error
    }
    await new Promise((resolve, reject) => setPending({ resolve: () => resolve(undefined), reject }))
    return call()
  }
  const dialog = pending ? (
    <StepUpDialog
      onConfirmed={() => (pending.resolve(), setPending(null))}
      onCancel={() => (pending.reject(new StepUpCancelled()), setPending(null))}
    />
  ) : null
  return { run, dialog }
}
