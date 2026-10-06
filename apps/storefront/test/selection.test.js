// M5-04: what the visitor's choices on the product page come to (plan/06-storefront/04-pdp.md sections 4 to 6). Pure.
import { describe, expect, it } from 'vitest'
import { buttonState, initialChosen, isCustomSize, lowestPrice, maxQuantity, stockLine, valueSoldOut, variantFor } from '../app/lib/selection'

const money = (/** @type {number} */ amount) => ({ amount, currency: 'PKR' })
const size = { id: 'size', name: 'Size', role: 'size', display: 'buttons', values: [{ id: 'S', label: 'S', kind: 'standard' }, { id: 'M', label: 'M', kind: 'standard' }, { id: 'C', label: 'Custom size', kind: 'custom' }] }
const colour = { id: 'col', name: 'Colour', role: 'color', display: 'swatch', values: [{ id: 'red', label: 'Red', kind: 'standard' }, { id: 'blue', label: 'Blue', kind: 'standard' }] }
const v = (/** @type {object} */ over) => /** @type {never} */ ({ id: 'v', sku: 'x', optionValueIds: [], price: money(100), stockStatus: 'in_stock', maxPerOrder: 10, ...over })
const variants = [
  v({ id: 'sr', optionValueIds: ['S', 'red'], price: money(100) }),
  v({ id: 'mr', optionValueIds: ['M', 'red'], price: money(120), stockStatus: 'sold_out' }),
  v({ id: 'sb', optionValueIds: ['S', 'blue'], stockStatus: 'sold_out' }),
  v({ id: 'mb', optionValueIds: ['M', 'blue'], stockStatus: 'low_stock', available: 2 }),
]
const options = /** @type {never[]} */ ([size, colour])

describe('which variant', () => {
  it('needs a value for every option', () => {
    expect(variantFor(options, variants, { size: 'S' })).toBeUndefined()
    expect(variantFor(options, variants, { size: 'M', col: 'blue' })?.id).toBe('mb')
  })
  it('a product with no options has its one variant, and nothing else is guessed', () => {
    expect(variantFor([], [v({ id: 'only' })], {})?.id).toBe('only')
    expect(variantFor([], variants, {})).toBeUndefined()
  })
})

describe('what is chosen at first', () => {
  it('nothing, when there is more than one variant', () => {
    expect(initialChosen(options, variants, null)).toEqual({})
  })
  it('the only variant is chosen for the visitor', () => {
    expect(initialChosen(/** @type {never[]} */ ([size]), [v({ id: 'a', optionValueIds: ['M'] })], null)).toEqual({ size: 'M' })
    expect(initialChosen([], [v({})], null)).toEqual({})
  })
  it('a size in the address is chosen when the product has it, and ignored when it has not', () => {
    expect(initialChosen(options, variants, 'm')).toEqual({ size: 'M' })
    expect(initialChosen(options, variants, 'XXL')).toEqual({})
  })
})

describe('a value that cannot be bought', () => {
  it('is one whose variants are all sold out given what else is chosen', () => {
    expect(valueSoldOut(variants, { col: 'red' }, 'size', 'M')).toBe(true) // red M is sold out
    expect(valueSoldOut(variants, { col: 'red' }, 'size', 'S')).toBe(false)
    expect(valueSoldOut(variants, {}, 'size', 'M')).toBe(false) // blue M is not
    expect(valueSoldOut(variants, { col: 'blue' }, 'size', 'S')).toBe(true)
  })
})

describe('the stock line and the quantity', () => {
  it('says low from the status or from five or fewer, and in stock when it is unknown', () => {
    expect(stockLine(v({ available: 3 }))).toEqual({ kind: 'low', n: 3 })
    expect(stockLine(v({ stockStatus: 'low_stock' }))).toEqual({ kind: 'low' })
    expect(stockLine(v({ available: 6 }))).toEqual({ kind: 'in_stock' })
    expect(stockLine(v({}))).toEqual({ kind: 'in_stock' })
    expect(stockLine(v({ stockStatus: 'preorder', preorderShipsAt: '2026-11-01' }))).toEqual({ kind: 'preorder', date: '2026-11-01' })
    expect(stockLine(v({ stockStatus: 'made_to_order' }))).toEqual({ kind: 'made_to_order' })
  })
  it('the most that can be ordered is what is left or the limit, whichever is less, and at least one', () => {
    expect(maxQuantity(v({ available: 2, maxPerOrder: 10 }))).toBe(2)
    expect(maxQuantity(v({ available: 20, maxPerOrder: 10 }))).toBe(10)
    expect(maxQuantity(v({ maxPerOrder: 4 }))).toBe(4)
    expect(maxQuantity(v({ available: 0, maxPerOrder: 4 }))).toBe(1)
  })
})

describe('the button', () => {
  it('asks for the first option that is not chosen', () => {
    const b = buttonState(options, variants, { col: 'red' })
    expect(b.state).toBe('select')
    expect(b.state === 'select' && b.missing.id).toBe('size')
  })
  it('follows the stock of the chosen variant', () => {
    expect(buttonState(options, variants, { size: 'S', col: 'red' }).state).toBe('add')
    expect(buttonState(options, variants, { size: 'M', col: 'red' }).state).toBe('sold_out')
    expect(buttonState(options, [v({ optionValueIds: ['S', 'red'], stockStatus: 'made_to_order' })], { size: 'S', col: 'red' }).state).toBe('order')
    expect(buttonState(options, [v({ optionValueIds: ['S', 'red'], stockStatus: 'preorder' })], { size: 'S', col: 'red' }).state).toBe('preorder')
  })
  it('a choice no variant has cannot be bought', () => {
    expect(buttonState(options, variants.slice(0, 1), { size: 'M', col: 'blue' })).toEqual({ state: 'unavailable' })
  })
})

describe('price and custom size', () => {
  it('shows the lowest price and says when the others differ', () => {
    expect(lowestPrice(variants).variant.price.amount).toBe(100)
    expect(lowestPrice(variants).varies).toBe(true)
    expect(lowestPrice([v({}), v({})]).varies).toBe(false)
  })
  it('knows the made-to-measure size', () => {
    expect(isCustomSize(options, { size: 'C' })).toBe(true)
    expect(isCustomSize(options, { size: 'M' })).toBe(false)
  })
})
