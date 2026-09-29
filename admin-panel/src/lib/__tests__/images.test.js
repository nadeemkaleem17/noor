import { describe, expect, it } from 'vitest'
import { addImages, imageRuleErrors, moveImage, normalizeImages, primaryImage, removeImage, setPrimary, updateImage } from '../images.js'
import { validateItem } from '../validate.js'
import * as F from '../../contract/fixtures.js'

const img = (id, sortOrder, isPrimary = false) => ({ id, url: `https://x.test/${id}.jpg`, alt: id, sortOrder, isPrimary })
const ids = (list) => list.map((i) => i.id)
const primaryId = (list) => list.filter((i) => i.isPrimary).map((i) => i.id)
const orders = (list) => list.map((i) => i.sortOrder)

describe('normalizeImages', () => {
  it('sorts by sortOrder and renumbers 0..n-1', () => {
    const out = normalizeImages([img('c', 7, true), img('a', 2), img('b', 5)])
    expect(ids(out)).toEqual(['a', 'b', 'c'])
    expect(orders(out)).toEqual([0, 1, 2])
  })
  it('keeps the current order for ties (stable)', () => {
    expect(ids(normalizeImages([img('x', 1), img('y', 1), img('z', 0)]))).toEqual(['z', 'x', 'y'])
  })
  it('makes the first image primary when none is', () => {
    expect(primaryId(normalizeImages([img('a', 0), img('b', 1)]))).toEqual(['a'])
  })
  it('keeps only the first primary when several are flagged', () => {
    expect(primaryId(normalizeImages([img('a', 0), img('b', 1, true), img('c', 2, true)]))).toEqual(['b'])
  })
  it('handles empty and missing input', () => {
    expect(normalizeImages([])).toEqual([])
    expect(normalizeImages()).toEqual([])
  })
  it('does not mutate its input', () => {
    const input = [img('b', 1), img('a', 0)]
    const snapshot = structuredClone(input)
    normalizeImages(input)
    expect(input).toEqual(snapshot)
  })
})

describe('addImages', () => {
  it('first image added to an empty gallery becomes primary', () => {
    const out = addImages([], [{ url: 'u1' }, { url: 'u2' }])
    expect(out).toHaveLength(2)
    expect(out[0].isPrimary).toBe(true)
    expect(out[1].isPrimary).toBe(false)
    expect(orders(out)).toEqual([0, 1])
    expect(out[0].id).toMatch(/^img_/)
  })
  it('appends after existing images without stealing primary', () => {
    const out = addImages([img('a', 0), img('b', 1, true)], [{ url: 'u3', alt: 'new', width: 800, height: 1000 }])
    expect(ids(out).slice(0, 2)).toEqual(['a', 'b'])
    expect(out[2]).toMatchObject({ url: 'u3', alt: 'new', sortOrder: 2, isPrimary: false, width: 800, height: 1000 })
    expect(primaryId(out)).toEqual(['b'])
  })
})

describe('moveImage (drag to reorder)', () => {
  const gallery = () => [img('a', 0, true), img('b', 1), img('c', 2), img('d', 3)]

  it('moves an image forward and renumbers', () => {
    const out = moveImage(gallery(), 0, 2)
    expect(ids(out)).toEqual(['b', 'c', 'a', 'd'])
    expect(orders(out)).toEqual([0, 1, 2, 3])
  })
  it('moves an image backward', () => {
    expect(ids(moveImage(gallery(), 3, 1))).toEqual(['a', 'd', 'b', 'c'])
  })
  it('primary stays with its image, not its position', () => {
    expect(primaryId(moveImage(gallery(), 0, 3))).toEqual(['a'])
  })
  it('out-of-range or same-index moves are no-ops', () => {
    expect(ids(moveImage(gallery(), 1, 1))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(moveImage(gallery(), -1, 2))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(moveImage(gallery(), 0, 9))).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('setPrimary ("set as main")', () => {
  it('makes exactly one image primary without changing order', () => {
    const out = setPrimary([img('a', 0, true), img('b', 1), img('c', 2)], 'c')
    expect(primaryId(out)).toEqual(['c'])
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })
  it('ignores an unknown id', () => {
    expect(primaryId(setPrimary([img('a', 0, true), img('b', 1)], 'zzz'))).toEqual(['a'])
  })
})

describe('removeImage', () => {
  it('removing a non-primary image keeps the primary', () => {
    const out = removeImage([img('a', 0, true), img('b', 1), img('c', 2)], 'b')
    expect(ids(out)).toEqual(['a', 'c'])
    expect(primaryId(out)).toEqual(['a'])
    expect(orders(out)).toEqual([0, 1])
  })
  it('removing the primary promotes the image that takes its place', () => {
    expect(primaryId(removeImage([img('a', 0), img('b', 1, true), img('c', 2)], 'b'))).toEqual(['c'])
  })
  it('removing a primary that was last promotes the new last image', () => {
    expect(primaryId(removeImage([img('a', 0), img('b', 1), img('c', 2, true)], 'c'))).toEqual(['b'])
  })
  it('removing the only image leaves an empty gallery', () => {
    expect(removeImage([img('a', 0, true)], 'a')).toEqual([])
  })
})

describe('updateImage / primaryImage', () => {
  it('patches alt text but never the id', () => {
    const out = updateImage([img('a', 0, true)], 'a', { alt: 'Front view', id: 'hijack' })
    expect(out[0]).toMatchObject({ id: 'a', alt: 'Front view' })
  })
  it('primaryImage returns the main image', () => {
    expect(primaryImage([img('a', 0), img('b', 1, true)]).id).toBe('b')
    expect(primaryImage([])).toBeUndefined()
  })
})

describe('image rules in product validation', () => {
  const product = () => structuredClone(F.seedProducts[0])

  it('every seed product has a valid gallery with one main image', () => {
    for (const p of F.seedProducts) {
      expect(imageRuleErrors(p.images)).toEqual([])
      expect(validateItem('products', p).success).toBe(true)
    }
  })
  it('rejects a gallery with two main images', () => {
    const p = product()
    p.images = [img('a', 0, true), img('b', 1, true)]
    const r = validateItem('products', p)
    expect(r.success).toBe(false)
    expect(r.errors.some((e) => e.path === 'images')).toBe(true)
  })
  it('rejects a gallery with no main image, even on a draft', () => {
    const p = { ...product(), status: 'draft', images: [img('a', 0), img('b', 1)] }
    expect(validateItem('products', p).success).toBe(false)
  })
  it('an empty gallery is allowed', () => {
    expect(validateItem('products', { ...product(), images: [] }).success).toBe(true)
  })
})
