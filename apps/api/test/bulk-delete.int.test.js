// Delete several at once (plan/10-api/00-conventions.md section 10): each item by the rules of a single delete, one that cannot go does not stop the others, and the answer says why.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { categories } from '../src/db/schema/taxonomy.js'
import { promos } from '../src/db/schema/promotions.js'
import { DomainError } from '../src/platform/errors.js'
import { eachOf } from '../src/platform/bulk.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

describe('eachOf (no database)', () => {
  it('does what it can, names what it could not with the reason, and counts an id once', async () => {
    /** @type {string[]} */
    const seen = []
    const out = await eachOf(['a', 'b', 'a', 'c'], async (id) => {
      seen.push(id)
      if (id === 'b') throw new DomainError('in_use', { usedBy: { children: 1, products: 2 } })
      if (id === 'c') throw new DomainError('not_found')
    })
    expect(seen).toEqual(['a', 'b', 'c'])
    expect(out).toEqual({ succeeded: ['a'], failed: [{ id: 'b', code: 'in_use', detail: 'It is used by 1 child category and 2 products, so it cannot be deleted.' }, { id: 'c', code: 'not_found' }] })
  })

  it('does not hide a real fault as a failed item', async () => {
    await expect(eachOf(['a'], async () => { throw new Error('database gone') })).rejects.toThrow('database gone')
  })
})

describe.skipIf(!dbAvailable)('bulk delete through HTTP (MySQL)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(promos)
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })

  const category = async (/** @type {any} */ b, /** @type {string} */ name, /** @type {string | null} */ parentId = null) =>
    (await b.call('POST', '/admin/categories', { body: { name, handle: name.toLowerCase().replace(/\W+/g, '-'), parentId, visible: true, attributes: [] } })).body.id

  it('removes the categories that can go, keeps the one that still has a child, and writes one audit entry for each removed', async () => {
    const { b } = await signedIn('owner')
    const parent = await category(b, 'Parent')
    const child = await category(b, 'Child', parent)
    const empty = await category(b, 'Empty')
    const res = await b.call('POST', '/admin/categories/bulk-delete', { body: { ids: [parent, child, empty, '0194f1b2-7c3a-7000-8000-0000000000ff'] } })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    // the parent is tried first and still has its child; the child then goes; the unknown id is reported, not a crash
    expect(res.body.succeeded).toEqual([child, empty])
    expect(res.body.failed).toEqual([
      { id: parent, code: 'in_use', detail: 'It is used by 1 child category, so it cannot be deleted.' },
      { id: '0194f1b2-7c3a-7000-8000-0000000000ff', code: 'not_found' },
    ])
    const left = await t.db.select().from(categories)
    expect(left.map((c) => c.id)).toEqual([parent])
    const audit = await t.migrate.db.select().from(auditLog)
    expect(audit.filter((a) => a.action === 'category.deleted')).toHaveLength(2)
  })

  it('needs the permission of a single delete, and a list that is not empty or too long', async () => {
    const { b } = await signedIn('support')
    expect((await b.call('POST', '/admin/categories/bulk-delete', { body: { ids: ['0194f1b2-7c3a-7000-8000-0000000000ff'] } })).status).toBe(403)
    expect((await b.call('POST', '/admin/promos/bulk-delete', { body: { ids: ['0194f1b2-7c3a-7000-8000-0000000000ff'] } })).status).toBe(403)
    const { b: owner } = await signedIn('owner')
    expect((await owner.call('POST', '/admin/categories/bulk-delete', { body: { ids: [] } })).status).toBe(400)
    expect((await owner.call('POST', '/admin/categories/bulk-delete', { body: { ids: Array.from({ length: 101 }, (_, i) => `0194f1b2-7c3a-7000-8000-${String(i).padStart(12, '0')}`) } })).status).toBe(400)
  })

  it('deletes promo codes that were never used', async () => {
    const { b } = await signedIn('owner')
    const make = async (/** @type {string} */ code) =>
      (await b.call('POST', '/admin/promos', { body: { code, type: 'percent', percent: 10, scope: 'all', excludeSaleItems: false, firstOrderOnly: false, enabled: true } })).body.id
    const [one, two] = [await make('BULKONE'), await make('BULKTWO')]
    const res = await b.call('POST', '/admin/promos/bulk-delete', { body: { ids: [one, two] } })
    expect(res.body).toEqual({ succeeded: [one, two], failed: [] })
    expect(await t.db.select().from(promos)).toHaveLength(0)
  })
})
