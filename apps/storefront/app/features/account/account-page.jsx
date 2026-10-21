import { useTranslation } from 'react-i18next'
import { Form, Link as RouterLink, useNavigation } from 'react-router'
import { formatDate } from '@noor/i18n'
import { accountPasswordRules } from '@noor/contract'
import { StatusBadge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { ShopPrice as Price } from '../catalog/shop-price'
import { useLocalePath, useShell } from '../layout/use-shell'

/**
 * The customer's page: who they are, the orders linked to the account (each opens its own order page), a way to add an order placed before, and the ways to change the password and to leave.
 * Everything is a plain form. The phone number is shown masked: it is the account's name and nobody needs to read it whole.
 * @param {{ account: import('@noor/contract').AccountMe, orders: { orderNumber: string, placedAt: string, total: import('@noor/contract').Money, status: string, trackingToken: string }[], result?: { ok?: boolean, done?: string, error?: string, reason?: string } | undefined }} props
 */
export function AccountPage({ account, orders, result }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const locale = useShell()?.locale ?? 'en'
  const busy = useNavigation().state !== 'idle'
  const said = result?.ok ? t(`account.done.${result.done}`, { defaultValue: '' }) : ''
  const failed = result && !result.ok ? (result.error === 'weak' ? t(`account.weak.${result.reason || 'common'}`, { defaultValue: t('account.errors.weak') }) : t(`account.errors.${result.error}`, { defaultValue: t('account.errors.failed') })) : ''
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-h1">{t('account.title', { name: account.name.split(/\s+/)[0] })}</h1>
          <p className="mt-1 text-fg-soft">
            <bdi dir="ltr">{account.phoneMasked}</bdi> · {t('account.since', { date: formatDate(account.registeredAt, locale) })}
          </p>
        </div>
        <Form method="post" action={path('/account')}>
          <input type="hidden" name="intent" value="signout" />
          <Button type="submit" variant="secondary">{t('account.signOut')}</Button>
        </Form>
      </header>

      {said ? <p role="status" className="mt-4 rounded-card bg-success-soft p-3 text-sm">{said}</p> : null}
      {failed ? <p role="alert" className="mt-4 rounded-card bg-danger-soft p-3 text-sm">{failed}</p> : null}

      <section aria-labelledby="acc-orders" className="mt-8">
        <h2 id="acc-orders" className="mb-2 font-heading text-h3">{t('account.orders')}</h2>
        {orders.length === 0 ? (
          <p className="text-fg-soft">{t('account.noOrders')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {orders.map((o) => (
              <li key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <RouterLink to={path(`/orders/${o.trackingToken}`)} className="font-medium underline underline-offset-4">{o.orderNumber}</RouterLink>
                  <span className="ms-2 text-fg-soft">{formatDate(o.placedAt, locale)}</span>
                </span>
                <span className="flex items-center gap-2"><StatusBadge status={/** @type {never} */ (o.status)} /><Price money={o.total} size="sm" /></span>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-3">
          <summary className="inline-flex h-(--control-h) cursor-pointer items-center rounded-control border border-line-strong px-4">{t('account.claim')}</summary>
          <Form method="post" action={path('/account')} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="intent" value="claim" />
            <p className="text-sm text-fg-soft">{t('account.claimHint')}</p>
            <Field label={t('track.orderNumber')} required hint={t('track.orderNumberHint')}>
              <Input name="orderNumber" required maxLength={40} autoCapitalize="characters" autoComplete="off" placeholder="RB-10458" dir="ltr" />
            </Field>
            <Field label={t('account.phone')} required>
              <Input name="phone" type="tel" inputMode="tel" required dir="ltr" placeholder="03xx xxxxxxx" />
            </Field>
            <div><Button type="submit" loading={busy}>{t('account.claimSubmit')}</Button></div>
          </Form>
        </details>
      </section>

      <section aria-labelledby="acc-details" className="mt-8">
        <h2 id="acc-details" className="mb-2 font-heading text-h3">{t('account.details')}</h2>
        <Form method="post" action={path('/account')} className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="update" />
          <Field label={t('account.name')} required>
            <Input name="name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={account.name} />
          </Field>
          <Field label={t('account.email')}>
            <Input name="email" type="email" dir="ltr" maxLength={254} autoComplete="email" defaultValue={account.email ?? ''} />
          </Field>
          <div><Button type="submit" variant="secondary" loading={busy}>{t('account.save')}</Button></div>
        </Form>
      </section>

      <section aria-labelledby="acc-password" className="mt-8">
        <h2 id="acc-password" className="mb-2 font-heading text-h3">{t('account.passwordTitle')}</h2>
        <Form method="post" action={path('/account')} className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="password" />
          <Field label={t('account.currentPassword')} required>
            <Input name="currentPassword" type="password" required autoComplete="current-password" maxLength={accountPasswordRules.max} />
          </Field>
          <Field label={t('account.newPassword')} required hint={t('account.passwordHint', { n: accountPasswordRules.min })}>
            <Input name="newPassword" type="password" required minLength={accountPasswordRules.min} maxLength={accountPasswordRules.max} autoComplete="new-password" />
          </Field>
          <div><Button type="submit" variant="secondary" loading={busy}>{t('account.changePassword')}</Button></div>
        </Form>
      </section>

      <section aria-labelledby="acc-leave" className="mt-8 border-t border-line pt-6">
        <h2 id="acc-leave" className="mb-2 font-heading text-h3">{t('account.leaveTitle')}</h2>
        <p className="mb-3 text-sm text-fg-soft">{t('account.leaveText')}</p>
        <details>
          <summary className="inline-flex h-(--control-h) cursor-pointer items-center rounded-control border border-line-strong px-4">{t('account.leave')}</summary>
          <Form method="post" action={path('/account')} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="intent" value="delete" />
            <Field label={t('account.password')} required hint={t('account.leaveConfirm')}>
              <Input name="password" type="password" required autoComplete="current-password" maxLength={accountPasswordRules.max} />
            </Field>
            <div><Button type="submit" variant="danger" loading={busy}>{t('account.leaveSubmit')}</Button></div>
          </Form>
        </details>
      </section>
    </div>
  )
}
