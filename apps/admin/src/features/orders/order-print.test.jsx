import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { invoiceFixture, oid } from '@/test/sales-data'

afterEach(resetApp)

const session = { 'GET /admin/me': () => json(200, me({ permissions: ['orders:read'] })) }

describe('invoice print view (plan/07-admin/05-orders.md section 5.2)', () => {
  it('draws the invoice with its number, the amount to collect and the order number as a barcode, outside the admin shell', async () => {
    fakeApi({ ...session, [`GET /admin/orders/${oid.order}/invoice`]: () => json(200, invoiceFixture()) })
    renderApp(`/orders/${oid.order}/print`)
    expect(await screen.findByText('Invoice INV-2026-000001')).toBeTruthy()
    expect(screen.getByText(/Cash to collect: Rs\.? ?7,240/)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Barcode of RB-10458' }).querySelectorAll('rect').length).toBeGreaterThan(20)
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull() // no sidebar
  })

  it('shows what a customer wrote as text: a script in the address never becomes an element', async () => {
    const evil = '<script>window.hacked = 1</script><img src=x onerror="window.hacked = 2">'
    fakeApi({
      ...session,
      [`GET /admin/orders/${oid.order}/invoice`]: () => json(200, invoiceFixture({ customer: { name: evil, phone: '0300 1234567' }, shippingAddress: { city: 'Lahore', address: evil, landmark: evil } })),
    })
    renderApp(`/orders/${oid.order}/print`)
    await screen.findByText('Invoice INV-2026-000001')
    const article = document.querySelector('article.invoice')
    expect(article?.querySelector('script')).toBeNull()
    expect(article?.querySelector('img')).toBeNull()
    expect(article?.textContent).toContain('<script>window.hacked = 1</script>')
    expect((/** @type {any} */ (window)).hacked).toBeUndefined()
  })

  it('prints several invoices of the orders on the list, one page each, and says which could not be loaded', async () => {
    const other = '0194f1b2-7c3a-7000-8000-000000000999'
    fakeApi({
      ...session,
      [`GET /admin/orders/${oid.order}/invoice`]: () => json(200, invoiceFixture()),
      [`GET /admin/orders/${other}/invoice`]: () => problem(404, 'not_found'),
    })
    renderApp(`/orders/print?ids=${oid.order},${other}`)
    await waitFor(() => expect(document.querySelectorAll('article.invoice').length).toBe(1))
    expect(await screen.findByText(`Order ${other} could not be loaded.`)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '2 invoices' })).toBeTruthy()
  })

  it('has nothing to print without an order', async () => {
    fakeApi(session)
    renderApp('/orders/print')
    expect(await screen.findByText('Nothing to print')).toBeTruthy()
  })
})
