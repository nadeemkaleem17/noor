import { useTranslation } from 'react-i18next'
import { Form, useLoaderData, useNavigation } from 'react-router'
import { accountPasswordRules } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Link as RouterLink } from 'react-router'
import { useLocalePath } from '../layout/use-shell'

/**
 * Sign in or register: one form each, plain POSTs (they work without JavaScript). What was typed comes back after a failure, except the password. The same words for a wrong number, an
 * unknown number and a wrong password.
 * @param {{ result?: { error?: string, reason?: string, fields?: string[], values?: { name: string, phone: string, email: string } } | undefined }} props
 */
export function AuthForm({ result }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { kind } = useLoaderData()
  const navigation = useNavigation()
  const registering = kind === 'register'
  const values = result?.values
  const bad = (/** @type {string} */ field) => result?.fields?.includes(field)
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-heading text-h1">{t(registering ? 'account.registerTitle' : 'account.loginTitle')}</h1>
      <p className="mt-2 text-fg-soft">{t(registering ? 'account.registerIntro' : 'account.loginIntro')}</p>
      <Form method="post" action={path(registering ? '/account/register' : '/account/login')} className="mt-6 flex flex-col gap-4">
        {registering ? (
          <Field label={t('account.name')} required {...(bad('name') ? { error: t('account.errors.name') } : {})}>
            <Input name="name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={values?.name ?? ''} invalid={bad('name') ?? false} />
          </Field>
        ) : null}
        <Field label={t('account.phone')} required hint={t('account.phoneHint')} {...(bad('phone') ? { error: t('account.errors.phone') } : {})}>
          <Input name="phone" type="tel" inputMode="tel" dir="ltr" required autoComplete="tel" placeholder="03xx xxxxxxx" defaultValue={values?.phone ?? ''} invalid={bad('phone') ?? false} />
        </Field>
        {registering ? (
          <Field label={t('account.email')} hint={t('account.emailHint')} {...(bad('email') ? { error: t('account.errors.email') } : {})}>
            <Input name="email" type="email" inputMode="email" dir="ltr" maxLength={254} autoComplete="email" defaultValue={values?.email ?? ''} invalid={bad('email') ?? false} />
          </Field>
        ) : null}
        <Field label={t('account.password')} required hint={registering ? t('account.passwordHint', { n: accountPasswordRules.min }) : undefined} {...(bad('password') ? { error: t('account.errors.password', { n: accountPasswordRules.min }) } : {})}>
          <Input name="password" type="password" required minLength={registering ? accountPasswordRules.min : 1} maxLength={accountPasswordRules.max} autoComplete={registering ? 'new-password' : 'current-password'} invalid={bad('password') ?? false} />
        </Field>
        {result?.error && result.error !== 'invalid' ? (
          <p role="alert" className="text-danger">{result.error === 'weak' ? t(`account.weak.${result.reason || 'common'}`, { defaultValue: t('account.errors.weak') }) : t(`account.errors.${result.error}`, { defaultValue: t('account.errors.failed') })}</p>
        ) : null}
        <Button type="submit" loading={navigation.state !== 'idle'} size="lg" fullWidth>{t(registering ? 'account.registerSubmit' : 'account.loginSubmit')}</Button>
      </Form>
      <p className="mt-6 text-sm text-fg-soft">
        {t(registering ? 'account.haveOne' : 'account.noneYet')}{' '}
        <RouterLink to={path(registering ? '/account/login' : '/account/register')} className="underline underline-offset-4">{t(registering ? 'account.loginTitle' : 'account.registerTitle')}</RouterLink>
      </p>
      <p className="mt-2 text-sm text-fg-soft">{t('account.guestOk')}</p>
    </div>
  )
}
