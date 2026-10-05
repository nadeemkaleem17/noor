import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { NewPasswordForm } from '../schemas'

/**
 * Two password fields (reset and invite). The strength rules are the server's; the form only checks length and that the two match.
 * @param {{ submitLabel: string; pending: boolean; error: unknown; onSubmit: (password: string) => void; }} props
 */
export function NewPasswordFormView({ submitLabel, pending, error, onSubmit }) {
  const { control, handleSubmit } = useForm({ resolver: zodResolver(NewPasswordForm), defaultValues: { password: '', confirm: '' } })
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((values) => onSubmit(values.password))}>
      <RHFField control={control} name="password" label="New password" hint="At least 12 characters. A phrase is easier to remember than a jumble." required>
        {(field) => <Input {...field} type="password" autoComplete="new-password" autoFocus required />}
      </RHFField>
      <RHFField control={control} name="confirm" label="Repeat the password" required>
        {(field) => <Input {...field} type="password" autoComplete="new-password" required />}
      </RHFField>
      <FormError error={error} />
      <Button type="submit" fullWidth loading={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}
