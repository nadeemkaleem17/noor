// Form-only schemas: they refine what the contract accepts and name their errors with codes the UI can translate (plan/05 section 3).
import { z } from '@noor/contract'

const email = z.string().trim().min(1, 'required').pipe(z.email('email_invalid'))

export const LoginForm = z.object({ email, password: z.string().min(1, 'required') })
export const CodeForm = z.object({ code: z.string().regex(/^\d{6}$/, 'code_invalid') })
export const RecoveryForm = z.object({ recoveryCode: z.string().trim().min(8, 'code_invalid').max(20, 'code_invalid') })
export const EmailForm = z.object({ email })
// strength is the server's call (`password_too_weak`); the length rule is repeated here so the person does not wait for a round trip
export const NewPasswordForm = z
  .object({ password: z.string().min(12, 'too_short').max(128, 'too_long'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'passwords_differ' })
