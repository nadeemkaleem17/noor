import { describe, expect, it } from 'vitest'
import { applyPlan, combinations, comboId, maxVariants, planVariants, skuFrom, valueIsLocked, variantLabel } from './variants'

const size = { values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }, { key: 'l', label: 'L' }] }
const fabric = { values: [{ key: 'lawn', label: 'Lawn' }, { key: 'silk', label: 'Silk' }] }
const v = (/** @type {string[]} */ keys, extra = {}) => ({ key: keys.join('-') || 'default', optionValueKeys: keys, enabled: true, ...extra })

describe('combinations', () => {
  it('is the product of the options, in option order', () => {
    expect(combinations([size, fabric]).map((c) => c.join('+'))).toEqual(['s+lawn', 's+silk', 'm+lawn', 'm+silk', 'l+lawn', 'l+silk'])
  })
  it('is one empty combination without options', () => {
    expect(combinations([])).toEqual([[]])
    expect(combinations([{ values: [] }])).toEqual([[]])
  })
  it('does not depend on the order of keys when comparing', () => {
    expect(comboId(['a', 'b'])).toBe(comboId(['b', 'a']))
  })
  it('stays inside the 100-variant cap for the sizes a shop uses', () => {
    expect(combinations([size, fabric]).length).toBeLessThan(maxVariants)
  })
})

describe('planVariants: adding a size keeps what exists (DOC-07.3 section 12)', () => {
  const existing = [v(['s']), v(['m'])]
  it('adds only the new combinations', () => {
    const plan = planVariants([size], existing)
    expect(plan.add).toEqual([['l']])
    expect(plan.keep).toHaveLength(2)
    expect(plan.remove).toEqual([])
  })
  it('lists variants that would be removed, and keeps the ones that appear on orders (disabled)', () => {
    const plan = planVariants([{ values: [{ key: 's', label: 'S' }] }], [v(['s']), v(['m']), v(['l'], { hasOrders: true })])
    expect(plan.remove.map((x) => x.key)).toEqual(['m'])
    expect(plan.disable.map((x) => x.key)).toEqual(['l'])
  })
})

describe('applyPlan', () => {
  it('keeps ids, SKUs and prices of kept variants and gives new ones an empty SKU', () => {
    const kept = { ...v(['s']), id: 'id-s', sku: 'KURTA-S', price: { amount: 349000 } }
    const result = applyPlan([size], [kept], (keys) => ({ ...v(keys), sku: '' }))
    expect(result.variants.map((x) => x.key)).toEqual(['s', 'm', 'l'])
    expect(result.variants[0]).toBe(kept)
    expect(result.variants[1]?.sku).toBe('')
    expect([result.added, result.removed, result.disabled]).toEqual([2, 0, 0])
  })
  it('disables a leftover variant that has orders instead of dropping it', () => {
    const ordered = v(['xl'], { hasOrders: true, id: 'id-xl' })
    const result = applyPlan([size], [ordered], (keys) => v(keys))
    expect(result.variants.at(-1)).toMatchObject({ key: 'xl', enabled: false })
    expect(result.disabled).toBe(1)
  })
})

describe('labels, SKUs and locked values', () => {
  it('labels a combination in option order', () => {
    expect(variantLabel([size, fabric], ['silk', 'm'])).toBe('M / Silk')
    expect(variantLabel([], [])).toBe('Default')
  })
  it('builds a valid SKU from a prefix and a label', () => {
    expect(skuFrom('kurta', 'M / Lawn')).toBe('KURTA-M-LAWN')
    expect(skuFrom('k', 'x'.repeat(60)).length).toBeLessThanOrEqual(40)
  })
  it('locks a value that a variant with orders uses', () => {
    expect(valueIsLocked([v(['s'], { hasOrders: true })], 's')).toBe(true)
    expect(valueIsLocked([v(['s'])], 's')).toBe(false)
  })
})
