// M4-12: the background work of payments calls what it should, and a method nobody registered is not configured. No database.
import { describe, expect, it, vi } from 'vitest'
import { paymentJobs } from '../src/modules/payments/jobs.js'
import { createProviders } from '../src/modules/payments/providers.js'

describe('payment jobs', () => {
  it('apply_event hands the stored event to the orders service, and expire_unpaid asks it to cancel what was not paid in time', async () => {
    const orders = { applyPaymentEvent: vi.fn(async () => ({})), expireUnpaid: vi.fn(async () => 2) }
    const jobs = paymentJobs(orders)
    await jobs['payments.apply_event']?.({ job: { payload: { eventId: 'evt-1' } } })
    await jobs['orders.expire_unpaid']?.({ job: { payload: {} } })
    expect(orders.applyPaymentEvent).toHaveBeenCalledWith('evt-1')
    expect(orders.expireUnpaid).toHaveBeenCalledTimes(1)
  })

  it('a method with no provider behind it is not configured and has no adapter', () => {
    const providers = createProviders()
    expect(providers.get('cod')?.id).toBe('cod')
    expect(providers.configured('cod')).toBe(true)
    expect(providers.configured('card')).toBe(false)
    expect(providers.get('card')).toBeUndefined()
  })
})
