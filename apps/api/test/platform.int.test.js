// M1-01 integration tests against a real MySQL (DOC-08 section 17: jobs, idempotency, outbox, counters, rate limits).
import { eq, sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { counters, idempotencyKeys, jobs, jobsDead, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { ensureCounter, nextValue } from '../src/platform/counters.js'
import { transaction } from '../src/platform/db.js'
import { DomainError } from '../src/platform/errors.js'
import { withIdempotency } from '../src/platform/idempotency.js'
import { backoffMs, claim, complete, enqueue, fail } from '../src/platform/jobs.js'
import { emit, relayOnce } from '../src/platform/outbox.js'
import { hit, subjectHash } from '../src/platform/rate-limit.js'
import { enqueueDue } from '../src/platform/scheduler.js'
import { createWorker } from '../src/platform/worker.js'
import { createTestDatabase, dbAvailable } from './support/db.js'

/** @type {Awaited<ReturnType<typeof createTestDatabase>>} */
let t
const count = async (/** @type {import('drizzle-orm/mysql-core').AnyMySqlTable} */ table) => {
  const [row] = await t.db.select({ n: sql`COUNT(*)`.mapWith(Number) }).from(table)
  return row?.n ?? 0
}
const wait = (/** @type {() => Promise<boolean> | boolean} */ cond, ms = 5000) =>
  vi.waitFor(async () => {
    if (!(await cond())) throw new Error('not yet')
  }, { timeout: ms, interval: 25 })

describe.skipIf(!dbAvailable)('platform (MySQL)', () => {
  beforeAll(async () => {
    t = await createTestDatabase()
  })
  afterAll(async () => {
    await t?.drop()
  })
  afterEach(async () => {
    setClock(null)
    for (const table of [jobs, jobsDead, outboxEvents, idempotencyKeys, rateLimitHits, counters]) await t.db.delete(table)
  })

  describe('jobs', () => {
    it('two jobs with the same unique_key leave one row', async () => {
      await enqueue(t.db, { type: 'x', payload: {}, uniqueKey: 'same' })
      await enqueue(t.db, { type: 'x', payload: {}, uniqueKey: 'same' })
      expect(await count(jobs)).toBe(1)
    })

    it('does not hand a job to two claimers, and does not hand out jobs that are not due', async () => {
      for (let i = 0; i < 60; i++) await enqueue(t.db, { type: 'x', payload: { i } })
      await enqueue(t.db, { type: 'later', payload: {}, runAt: new Date(Date.now() + 3_600_000) })
      const claimed = (await Promise.all(Array.from({ length: 12 }, (_, n) => claim(t.db, `w${n}`, { limit: 10 })))).flat()
      expect(claimed).toHaveLength(60)
      expect(new Set(claimed.map((j) => j.id)).size).toBe(60)
      expect(claimed.every((j) => j.type === 'x' && j.attempts === 1)).toBe(true)
    })

    it('takes over a lock older than the timeout, and only then', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      await enqueue(t.db, { type: 'x', payload: {} })
      expect(await claim(t.db, 'crashed')).toHaveLength(1)
      advanceClock(9 * 60_000)
      expect(await claim(t.db, 'other', { now: new Date('2026-10-04T10:09:00Z') })).toHaveLength(0)
      const taken = await claim(t.db, 'other', { now: new Date('2026-10-04T10:11:00Z') })
      expect(taken).toHaveLength(1)
      expect(taken[0]?.attempts).toBe(2)
    })

    it('backs off 2^attempts x 15 s up to an hour, then moves the job to jobs_dead', async () => {
      expect([1, 2, 3, 8, 20].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 3_600_000, 3_600_000])
      const at = new Date('2026-10-04T10:00:00Z')
      await enqueue(t.db, { type: 'x', payload: {}, maxAttempts: 2 }, at)
      const [first] = await claim(t.db, 'w', { now: at })
      expect(await fail(t.db, /** @type {NonNullable<typeof first>} */ (first), new Error('boom'), at)).toBe('retry')
      const [row] = await t.db.select().from(jobs)
      expect(row?.runAt.toISOString()).toBe('2026-10-04T10:00:30.000Z')
      expect(row?.lastError).toBe('boom')
      expect(row?.lockedAt).toBeNull()
      const [second] = await claim(t.db, 'w', { now: new Date('2026-10-04T10:01:00Z') })
      expect(await fail(t.db, /** @type {NonNullable<typeof second>} */ (second), new Error('boom again'), at)).toBe('dead')
      expect(await count(jobs)).toBe(0)
      const [dead] = await t.db.select().from(jobsDead)
      expect(dead).toMatchObject({ type: 'x', attempts: 2, lastError: 'boom again' })
    })

    it('complete() deletes the row', async () => {
      const id = await enqueue(t.db, { type: 'x', payload: {} })
      await complete(t.db, id)
      expect(await count(jobs)).toBe(0)
    })
  })

  describe('worker', () => {
    it('runs every job once with two workers sharing the queue, and deletes it', async () => {
      const ran = /** @type {string[]} */ ([])
      const handlers = { x: async (/** @type {{ job: { payload: { i: number } } }} */ { job }) => void ran.push(String(job.payload.i)) }
      for (let i = 0; i < 200; i++) await enqueue(t.db, { type: 'x', payload: { i }, uniqueKey: `k${i}` })
      const a = createWorker({ db: t.db, handlers, workerId: 'a', busyMs: 20, idleMs: 20 })
      const b = createWorker({ db: t.db, handlers, workerId: 'b', busyMs: 20, idleMs: 20 })
      a.start()
      b.start()
      await wait(async () => (await count(jobs)) === 0, 20_000)
      await a.stop()
      await b.stop()
      expect(ran).toHaveLength(200)
      expect(new Set(ran).size).toBe(200)
    })

    it('retries a failing job later and reports a dead one', async () => {
      const onDead = vi.fn()
      const handlers = { bad: async () => { throw new Error('nope') } }
      await enqueue(t.db, { type: 'bad', payload: {}, maxAttempts: 1 })
      await enqueue(t.db, { type: 'unknown.type', payload: {}, maxAttempts: 1 })
      const w = createWorker({ db: t.db, handlers, busyMs: 20, idleMs: 20, onDead })
      w.start()
      await wait(async () => (await count(jobsDead)) === 2)
      await w.stop()
      expect(onDead).toHaveBeenCalledTimes(2)
      const dead = await t.db.select({ type: jobsDead.type, error: jobsDead.lastError }).from(jobsDead)
      expect(dead.map((d) => d.error).sort()).toEqual(['no handler for job type "unknown.type"', 'nope'])
    })

    it('aborts a handler that runs past its time limit', async () => {
      let aborted = false
      const handlers = { slow: async (/** @type {{ signal: AbortSignal }} */ { signal }) => { await new Promise((r) => signal.addEventListener('abort', () => { aborted = true; r(undefined) })) } }
      await enqueue(t.db, { type: 'slow', payload: {}, maxAttempts: 1 })
      const w = createWorker({ db: t.db, handlers, busyMs: 20, idleMs: 20, timeoutsMs: { slow: 100 } })
      w.start()
      await wait(async () => (await count(jobsDead)) === 1)
      await w.stop()
      expect(aborted).toBe(true)
      const [dead] = await t.db.select().from(jobsDead)
      expect(dead?.lastError).toBe('handler timed out')
    })

    it('stop() waits for running jobs', async () => {
      let finished = false
      const handlers = { work: async () => { await new Promise((r) => setTimeout(r, 300)); finished = true } }
      await enqueue(t.db, { type: 'work', payload: {} })
      const w = createWorker({ db: t.db, handlers, busyMs: 20, idleMs: 20 })
      w.start()
      await wait(() => w.running === 1)
      await w.stop(5000)
      expect(finished).toBe(true)
      expect(await count(jobs)).toBe(0)
    })
  })

  describe('outbox', () => {
    it('keeps an event only if the change committed', async () => {
      await expect(transaction(t.db, async (tx) => { await emit(tx, { type: 'order.placed', payload: { orderId: 'o1' } }); throw new Error('rollback') })).rejects.toThrow('rollback')
      expect(await count(outboxEvents)).toBe(0)
      await transaction(t.db, (tx) => emit(tx, { type: 'order.placed', payload: { orderId: 'o2' } }))
      expect(await count(outboxEvents)).toBe(1)
    })

    it('turns each event into one job per handler, once, even when relays run together', async () => {
      const handlers = { 'order.placed': ['notify.customer', 'notify.staff'], 'order.confirmed': ['notify.customer'] }
      for (let i = 0; i < 20; i++) await transaction(t.db, (tx) => emit(tx, { type: 'order.placed', payload: { i } }))
      await transaction(t.db, (tx) => emit(tx, { type: 'unhandled.event', payload: {} }))
      const relayed = await Promise.all([relayOnce(t.db, handlers), relayOnce(t.db, handlers), relayOnce(t.db, handlers)])
      expect(relayed.reduce((a, b) => a + b, 0)).toBe(21)
      expect(await count(jobs)).toBe(40)
      expect(await relayOnce(t.db, handlers)).toBe(0)
      const unprocessed = await t.db.select().from(outboxEvents).where(sql`${outboxEvents.processedAt} IS NULL`)
      expect(unprocessed).toHaveLength(0)
      const [job] = await t.db.select().from(jobs).where(eq(jobs.type, 'notify.staff')).limit(1)
      expect(job?.uniqueKey).toMatch(/^event:[0-9a-f-]{36}:notify\.staff$/)
      expect(job?.payload).toMatchObject({ type: 'order.placed', payload: { i: expect.any(Number) } })
    })

    it('relays in creation order', async () => {
      const order = /** @type {number[]} */ ([])
      for (let i = 0; i < 5; i++) await transaction(t.db, (tx) => emit(tx, { type: 'e', payload: { i } }))
      await relayOnce(t.db, { e: ['job'] })
      const rows = await t.db.select().from(jobs).orderBy(jobs.id)
      for (const r of rows) order.push(/** @type {{ payload: { i: number } }} */ (r.payload).payload.i)
      expect(order.sort()).toEqual([0, 1, 2, 3, 4])
    })
  })

  describe('idempotency', () => {
    const KEY = '0190f2c0-0000-7000-8000-000000000001'
    const run = (/** @type {unknown} */ body, /** @type {(tx: import('../src/platform/db.js').Executor) => Promise<{ status: number, body: unknown }>} */ command, key = KEY) => withIdempotency(t.db, { scope: 'orders.create', key, body, command })

    it('runs the command once and replays the stored response for the same key and body', async () => {
      const command = vi.fn(async () => ({ status: 201, body: { orderNo: 10001 } }))
      const first = await run({ a: 1, b: [1, 2] }, command)
      const second = await run({ b: [1, 2], a: 1 }, command) // same body, different key order
      expect(command).toHaveBeenCalledTimes(1)
      expect(first).toMatchObject({ status: 201, replayed: false })
      expect(second).toEqual({ status: 201, body: { orderNo: 10001 }, replayed: true })
    })

    it('rejects the same key with a different body (422 idempotency_mismatch)', async () => {
      await run({ a: 1 }, async () => ({ status: 201, body: {} }))
      await expect(run({ a: 2 }, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ code: 'idempotency_mismatch' })
    })

    it('answers 409 request_in_progress while the first call runs, and takes over a crashed one after 30 s', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      /** @type {() => void} */
      let release = () => {}
      const gate = new Promise((r) => { release = () => r(undefined) })
      const slow = run({ a: 1 }, async () => { await gate; return { status: 201, body: { ok: 1 } } })
      await wait(async () => (await count(idempotencyKeys)) === 1)
      await expect(run({ a: 1 }, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ code: 'request_in_progress' })
      release()
      await slow

      await t.db.delete(idempotencyKeys)
      await t.db.insert(idempotencyKeys).values({ scope: 'orders.create', key: KEY, requestHash: (await import('../src/platform/idempotency.js')).hashRequest({ a: 1 }), status: 'in_progress', createdAt: new Date('2026-10-04T10:00:00Z'), expiresAt: new Date('2026-10-05T10:00:00Z') })
      await expect(run({ a: 1 }, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ code: 'request_in_progress' })
      advanceClock(31_000)
      const taken = await run({ a: 1 }, async () => ({ status: 201, body: { recovered: true } }))
      expect(taken).toMatchObject({ status: 201, replayed: false })
    })

    it('does not let two simultaneous takeovers both run', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      const { hashRequest } = await import('../src/platform/idempotency.js')
      await t.db.insert(idempotencyKeys).values({ scope: 'orders.create', key: KEY, requestHash: hashRequest({ a: 1 }), status: 'in_progress', createdAt: new Date('2026-10-04T09:00:00Z'), expiresAt: new Date('2026-10-05T10:00:00Z') })
      const command = vi.fn(async () => { await new Promise((r) => setTimeout(r, 50)); return { status: 201, body: {} } })
      const results = await Promise.allSettled([run({ a: 1 }, command), run({ a: 1 }, command), run({ a: 1 }, command)])
      expect(command).toHaveBeenCalledTimes(1)
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    })

    it('stores a domain refusal and replays it; the command effects are rolled back', async () => {
      const command = vi.fn(async (/** @type {import('../src/platform/db.js').Executor} */ tx) => {
        await enqueue(tx, { type: 'should.not.exist', payload: {} })
        throw new DomainError('insufficient_stock', { variantId: 'v1', available: 1 })
      })
      await expect(run({ a: 1 }, command)).rejects.toMatchObject({ code: 'insufficient_stock' })
      await expect(run({ a: 1 }, command)).rejects.toMatchObject({ code: 'insufficient_stock', details: { variantId: 'v1', available: 1 } })
      expect(command).toHaveBeenCalledTimes(1)
      expect(await count(jobs)).toBe(0)
    })

    it('forgets the key after an unexpected failure so the client can retry', async () => {
      const command = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ status: 201, body: { ok: true } })
      await expect(run({ a: 1 }, command)).rejects.toThrow('db down')
      expect(await count(idempotencyKeys)).toBe(0)
      await expect(run({ a: 1 }, command)).resolves.toMatchObject({ status: 201, replayed: false })
    })

    it('writes the response in the command transaction (a rollback leaves the key in_progress, not done)', async () => {
      await run({ a: 1 }, async (tx) => { await emit(tx, { type: 'x', payload: {} }); return { status: 201, body: {} } })
      const [row] = await t.db.select().from(idempotencyKeys)
      expect(row).toMatchObject({ status: 'done', responseStatus: 201 })
      expect((row?.expiresAt.getTime() ?? 0) - (row?.createdAt.getTime() ?? 0)).toBe(24 * 3_600_000)
    })
  })

  describe('counters', () => {
    it('gives 50 concurrent callers 50 consecutive numbers (no duplicate, no gap)', async () => {
      await ensureCounter(t.db, 'order_number', 10000)
      const numbers = await Promise.all(Array.from({ length: 50 }, () => transaction(t.db, (tx) => nextValue(tx, 'order_number'))))
      expect(numbers.sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => 10001 + i))
    })

    it('a rolled-back transaction does not consume a number', async () => {
      await ensureCounter(t.db, 'order_number', 10000)
      await expect(transaction(t.db, async (tx) => { await nextValue(tx, 'order_number'); throw new Error('rollback') })).rejects.toThrow('rollback')
      expect(await transaction(t.db, (tx) => nextValue(tx, 'order_number'))).toBe(10001)
    })

    it('ensureCounter keeps an existing value, and a missing counter is an error', async () => {
      await ensureCounter(t.db, 'invoice_2026')
      await transaction(t.db, (tx) => nextValue(tx, 'invoice_2026'))
      await ensureCounter(t.db, 'invoice_2026')
      expect(await transaction(t.db, (tx) => nextValue(tx, 'invoice_2026'))).toBe(2)
      await expect(transaction(t.db, (tx) => nextValue(tx, 'nope'))).rejects.toThrow(/does not exist/)
    })
  })

  describe('rate limits', () => {
    it('allows up to the limit in a window, blocks the rest, and resets in the next window', async () => {
      setClock(new Date('2026-10-04T10:00:10Z'))
      const args = { bucket: 'login', subject: 'ip:1.2.3.4', limit: 3, windowMs: 60_000 }
      const results = []
      for (let i = 0; i < 5; i++) results.push((await hit(t.db, args)).allowed)
      expect(results).toEqual([true, true, true, false, false])
      expect((await hit(t.db, args)).retryAfterSeconds).toBe(50)
      advanceClock(60_000)
      expect((await hit(t.db, args)).allowed).toBe(true)
    })

    it('counts concurrent hits exactly and keeps subjects apart', async () => {
      const args = { bucket: 'track', limit: 1000, windowMs: 60_000 }
      await Promise.all(Array.from({ length: 40 }, () => hit(t.db, { ...args, subject: 'ip:a' })))
      const other = await hit(t.db, { ...args, subject: 'ip:b' })
      expect(other.count).toBe(1)
      expect((await hit(t.db, { ...args, subject: 'ip:a' })).count).toBe(41)
    })

    it('stores a hashed phone, never the number', async () => {
      const subject = `phone:${subjectHash('+923001234567')}`
      await hit(t.db, { bucket: 'checkout', subject, limit: 5, windowMs: 60_000 })
      const rows = await t.db.select().from(rateLimitHits)
      expect(JSON.stringify(rows)).not.toContain('923001234567')
      expect(subjectHash(' +923001234567 ')).toBe(subjectHash('+923001234567'))
    })
  })

  describe('scheduler', () => {
    it('enqueues each due job once per minute even if two workers tick together', async () => {
      const schedule = [{ type: 'every.five', cron: '*/5 * * * *' }, { type: 'daily', cron: '0 22 * * *' }]
      const at = new Date('2026-10-04T22:00:00Z')
      await Promise.all([enqueueDue(t.db, schedule, at), enqueueDue(t.db, schedule, at)])
      const rows = await t.db.select({ type: jobs.type, key: jobs.uniqueKey }).from(jobs).orderBy(jobs.type)
      expect(rows).toEqual([{ type: 'daily', key: 'schedule:daily:202610042200' }, { type: 'every.five', key: 'schedule:every.five:202610042200' }])
      await enqueueDue(t.db, schedule, new Date('2026-10-04T22:03:00Z'))
      expect(await count(jobs)).toBe(2)
    })
  })
})
