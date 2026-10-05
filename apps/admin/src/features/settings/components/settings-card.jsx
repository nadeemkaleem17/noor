import { ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { set, useForm } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { messageFor } from '@/lib/errors'
import { contractResolver } from '@/lib/form'
import { useCan } from '@/lib/session'

/** Moves each error to the path `errorPath` gives it. @param {Record<string, any>} errors @param {(path: string) => string} errorPath */
function remap(errors, errorPath) {
  /** @type {Record<string, any>} */
  const out = {}
  /** @param {Record<string, any>} node @param {string} prefix */
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && 'message' in v && 'type' in v) set(out, errorPath(prefix + k), v)
      else if (v && typeof v === 'object') walk(v, `${prefix}${k}.`)
    }
  }
  walk(errors, '')
  return out
}

/**
 * One card of a settings screen with its own form and Save (plan/07-admin/11-settings.md section 2): the cards are independent, so saving one never saves another.
 * `toValue` turns the form values into what the API takes; `schema` checks that value.
 * @template {Record<string, any>} V
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {V} props.defaults
 * @param {import('@noor/contract').z.ZodType} props.schema
 * @param {(values: V) => Record<string, unknown>} props.toValue
 * @param {(path: string) => string} [props.errorPath] - maps a server error path to the field that shows it, when the form is not shaped like the document
 * @param {(value: Record<string, unknown>) => Promise<unknown>} props.save - resolves when the document is saved; rejects with the API's error
 * @param {(form: import('react-hook-form').UseFormReturn<V>, writable: boolean) => import('react').ReactNode} props.children
 */
export function SettingsCard({ id, title, description, defaults, schema, toValue, errorPath = (p) => p, save, children }) {
  const can = useCan()
  const toast = useToast()
  const writable = can('settings:write')
  const base = contractResolver(schema, /** @type {any} */ (toValue))
  const form = useForm({
    defaultValues: /** @type {any} */ (defaults),
    // the document's error paths name the form's fields, except where `errorPath` says otherwise
    resolver: async (values, context, options) => {
      const result = await base(values, context, options)
      return Object.keys(result.errors).length === 0 ? result : { values: {}, errors: remap(result.errors, errorPath) }
    },
  })

  async function submit() {
    try {
      await save(toValue(/** @type {V} */ (form.getValues())))
      form.reset(form.getValues())
      toast.push({ title: `${title} saved`, tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <SectionCard id={id} title={title} description={description}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(submit)(e)} className="space-y-4">
        {children(/** @type {any} */ (form), writable)}
        {writable ? (
          <div className="flex justify-end">
            <Button type="submit" loading={form.formState.isSubmitting} disabled={Object.keys(form.formState.dirtyFields).length === 0}>
              Save {title.toLowerCase()}
            </Button>
          </div>
        ) : null}
      </form>
    </SectionCard>
  )
}
