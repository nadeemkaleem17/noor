import { messageFor } from '@/lib/errors'

/** The failure of the last call, as a sentence under the form. Nothing when there is none. @param {{ error: unknown; }} props */
export function FormError({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {messageFor(error)}
    </p>
  )
}
