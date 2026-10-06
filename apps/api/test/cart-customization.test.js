// M4-03: what may be attached to a cart line, with no database (plan/09-data-model/06-cart-promotions.md section 2.2).
import { describe, expect, it } from 'vitest'
import { customizationHash, customizationIssues, customizationSummary, fieldIssues, normalise } from '../src/modules/cart/customization.js'

const field = (/** @type {object} */ over) => ({ key: 'chest', label: 'Chest', type: /** @type {const} */ ('number'), required: false, ...over })
const none = { fields: [], allowNotes: false, bundleChildIds: null }
const paths = (/** @type {ReturnType<typeof customizationIssues>} */ issues) => issues.map((i) => `${i.path}:${i.code}`)

describe('identity', () => {
  it('nothing, an empty object and blank notes are all "no customisation", with an empty hash', () => {
    for (const c of [undefined, {}, { measurements: {} }, { notes: '   ' }, { bundle: [] }]) {
      expect(normalise(c)).toBeUndefined()
      expect(customizationHash(normalise(c))).toBe('')
    }
  })

  it('keeps what is there and trims the note', () => {
    expect(normalise({ measurements: { chest: 38 }, notes: ' short hem ', bundle: [{ productId: 'a', variantId: 'b' }] })).toEqual({ measurements: { chest: 38 }, notes: 'short hem', bundle: [{ productId: 'a', variantId: 'b' }] })
  })

  it('the same choices give the same hash whatever the key order; different choices do not', () => {
    const a = customizationHash(normalise({ measurements: { chest: 38, waist: 32 }, notes: 'x' }))
    const b = customizationHash(normalise({ notes: 'x', measurements: { waist: 32, chest: 38 } }))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(b)
    expect(customizationHash(normalise({ measurements: { chest: 39, waist: 32 }, notes: 'x' }))).not.toBe(a)
    const one = [{ productId: 'a', variantId: '1' }, { productId: 'b', variantId: '2' }]
    expect(customizationHash(normalise({ bundle: one }))).not.toBe(customizationHash(normalise({ bundle: [...one].reverse() }))) // the order of a list is part of it
  })
})

describe('measurements', () => {
  const rules = { ...none, fields: [field({ required: true, min: 20, max: 60 }), field({ key: 'style', label: 'Style', type: 'select', options: [{ value: 'a', label: 'A' }] }), field({ key: 'remark', label: 'Remark', type: 'text' })] }

  it('accepts numbers and numeric text within the range, a listed option, and short text', () => {
    expect(customizationIssues({ measurements: { chest: 38 } }, rules)).toEqual([])
    expect(customizationIssues({ measurements: { chest: '38.5', style: 'a', remark: 'x' } }, rules)).toEqual([])
  })

  it('names the field that is missing, out of range, not a number, not an option, or too long', () => {
    expect(paths(customizationIssues(undefined, rules))).toEqual(['customization.measurements.chest:required'])
    expect(paths(customizationIssues({ measurements: { chest: '' } }, rules))).toEqual(['customization.measurements.chest:required'])
    expect(paths(customizationIssues({ measurements: { chest: 10 } }, rules))).toEqual(['customization.measurements.chest:too_small'])
    expect(paths(customizationIssues({ measurements: { chest: 61 } }, rules))).toEqual(['customization.measurements.chest:too_big'])
    expect(paths(customizationIssues({ measurements: { chest: 'wide' } }, rules))).toEqual(['customization.measurements.chest:invalid_format'])
    expect(paths(customizationIssues({ measurements: { chest: ' ' } }, rules))).toEqual(['customization.measurements.chest:invalid_format'])
    expect(paths(customizationIssues({ measurements: { chest: 38, style: 'z' } }, rules))).toEqual(['customization.measurements.style:invalid_format'])
    expect(paths(customizationIssues({ measurements: { chest: 38, remark: 'x'.repeat(101) } }, rules))).toEqual(['customization.measurements.remark:too_long'])
  })

  it('a field the form does not have is refused; an optional one may be left out; a field with no bounds takes any number', () => {
    expect(paths(customizationIssues({ measurements: { sleeve: 20 } }, { ...none, fields: [field({})] }))).toEqual(['customization.measurements.sleeve:invalid_format'])
    expect(customizationIssues(undefined, { ...none, fields: [field({})] })).toEqual([])
    expect(customizationIssues({ measurements: { chest: -5 } }, { ...none, fields: [field({})] })).toEqual([])
  })

  it('a note needs the form to allow notes', () => {
    expect(paths(customizationIssues({ notes: 'x' }, none))).toEqual(['customization.notes:invalid_format'])
    expect(customizationIssues({ notes: 'x' }, { ...none, allowNotes: true })).toEqual([])
  })
})

describe('bundles', () => {
  const rules = { ...none, bundleChildIds: ['kurta', 'dupatta'] }
  const pick = (/** @type {string} */ productId) => ({ productId, variantId: `v-${productId}` })

  it('needs one variant for every child, no more, no repeats', () => {
    expect(customizationIssues({ bundle: [pick('kurta'), pick('dupatta')] }, rules)).toEqual([])
    expect(paths(customizationIssues(undefined, rules))).toEqual(['customization.bundle:required'])
    expect(paths(customizationIssues({ bundle: [pick('kurta')] }, rules))).toEqual(['customization.bundle:required'])
    expect(paths(customizationIssues({ bundle: [pick('kurta'), pick('stranger')] }, rules))).toEqual(['customization.bundle.1.productId:invalid_format', 'customization.bundle:required'].slice(0, 1).concat(['customization.bundle:required']))
    expect(paths(customizationIssues({ bundle: [pick('kurta'), pick('kurta'), pick('dupatta')] }, rules))).toEqual(['customization.bundle.1.productId:not_unique'])
  })

  it('a bundle with no children asks for nothing; a product that is not a bundle takes no bundle', () => {
    expect(customizationIssues(undefined, { ...none, bundleChildIds: [] })).toEqual([])
    expect(paths(customizationIssues({ bundle: [pick('kurta')] }, none))).toEqual(['customization.bundle:invalid_format'])
  })
})

describe('summary', () => {
  const fields = [field({ unit: 'in' }), field({ key: 'style', label: 'Style', type: 'text' })]
  it('reads measurements with their units and the chosen bundle variants', () => {
    expect(customizationSummary({ measurements: { chest: 38, style: 'a-line', other: 5 } }, fields, new Map())).toBe('Chest 38 in, Style a-line, other 5')
    const labels = new Map([['v1', 'Kurta (M)'], ['v2', 'Dupatta (Free size)']])
    expect(customizationSummary({ bundle: [{ productId: 'a', variantId: 'v1' }, { productId: 'b', variantId: 'v2' }, { productId: 'c', variantId: 'gone' }] }, [], labels)).toBe('Kurta (M), Dupatta (Free size)')
    expect(customizationSummary({ measurements: { chest: 38 }, bundle: [{ productId: 'a', variantId: 'v1' }] }, fields, labels)).toBe('Chest 38 in; Kurta (M)')
  })
  it('says nothing when there is nothing to say', () => {
    expect(customizationSummary(undefined, fields, new Map())).toBeUndefined()
    expect(customizationSummary({ notes: 'only a note' }, fields, new Map())).toBeUndefined()
  })
})

describe('fieldIssues (the same checks for the extra checkout fields)', () => {
  const fields = [field({ key: 'gift', label: 'Gift', type: 'checkbox' }), field({ key: 'message', label: 'Message', type: 'textarea' })]
  it('a checkbox is true or false; a long text may be longer than a short one', () => {
    expect(fieldIssues(fields, { gift: true, message: 'x'.repeat(250) }, 'customFields')).toEqual([])
    expect(paths(fieldIssues(fields, { gift: 'yes' }, 'customFields'))).toEqual(['customFields.gift:invalid_format'])
    expect(paths(fieldIssues(fields, { message: 'x'.repeat(251) }, 'customFields'))).toEqual(['customFields.message:too_long'])
    expect(paths(fieldIssues(fields, { unknown: 1 }, 'customFields'))).toEqual(['customFields.unknown:invalid_format'])
  })
})
