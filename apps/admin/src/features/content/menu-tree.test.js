import { describe, expect, it } from 'vitest'
import { add, edit, fromApi, hasRoom, indent, move, outdent, remove, toApi } from './menu-tree'

const leaf = (/** @type {string} */ label, children = /** @type {any[]} */ ([])) => ({ key: label, label, href: `/${label}`, children })
/** @param {any[]} nodes @returns {any[]} */
const labels = (nodes) => nodes.map((n) => (n.children.length ? [n.label, labels(n.children)] : n.label))

describe('menu tree edits', () => {
  const tree = [leaf('new'), leaf('women', [leaf('stitched'), leaf('unstitched')]), leaf('sale')]

  it('moves within siblings, and stops at the ends', () => {
    expect(labels(move(tree, [2], -1))).toEqual(['new', 'sale', ['women', ['stitched', 'unstitched']]])
    expect(labels(move(tree, [0], -1))).toEqual(labels(tree))
    expect(labels(move(tree, [1, 0], 1))).toEqual(['new', ['women', ['unstitched', 'stitched']], 'sale'])
    expect(labels(move(tree, [1, 1], 1))).toEqual(labels(tree))
  })

  it('indents under the item above and outdents after the parent', () => {
    expect(labels(indent('main', tree, 2))).toEqual(['new', ['women', ['stitched', 'unstitched', 'sale']]])
    expect(labels(outdent('main', tree, 1, 0))).toEqual(['new', ['women', ['unstitched']], 'stitched', 'sale'])
  })

  it('does not indent where there is no second level, no item above, or no room', () => {
    expect(indent('footer', tree, 2)).toBe(tree)
    expect(indent('main', tree, 0)).toBe(tree)
    const full = [leaf('a', Array.from({ length: 12 }, (_, i) => leaf(`c${i}`))), leaf('b')]
    expect(indent('main', full, 1)).toBe(full)
    expect(indent('main', [leaf('a'), leaf('b', [leaf('c')])], 1)).toEqual([leaf('a'), leaf('b', [leaf('c')])]) // an item with children stays a parent
  })

  it('does not outdent past the top-level limit', () => {
    const eight = [...Array.from({ length: 7 }, (_, i) => leaf(`t${i}`)), leaf('p', [leaf('c')])]
    expect(eight).toHaveLength(8)
    expect(outdent('main', eight, 7, 0)).toBe(eight)
  })

  it('removes, edits and adds', () => {
    expect(labels(remove(tree, [1, 0]))).toEqual(['new', ['women', ['unstitched']], 'sale'])
    expect(edit(tree, [0], { label: 'fresh' })[0]?.label).toBe('fresh')
    expect(labels(add(tree, 1))).toEqual(['new', ['women', ['stitched', 'unstitched', '']], 'sale'])
    expect(add(tree).at(-1)).toMatchObject({ label: '', href: '', children: [] })
  })

  it('knows the limits of each menu', () => {
    expect(hasRoom('main', Array.from({ length: 8 }, () => leaf('x')))).toBe(false)
    expect(hasRoom('main', [leaf('x')])).toBe(true)
    expect(hasRoom('footer', [leaf('x')], 0)).toBe(false) // the footer has one level
    expect(hasRoom('footer', Array.from({ length: 9 }, () => leaf('x')))).toBe(true)
    expect(hasRoom('footer', Array.from({ length: 10 }, () => leaf('x')))).toBe(false)
  })

  it('round-trips with the API shape, keeping ids and dropping empty child lists', () => {
    const api = [{ id: 'a1', label: 'Women', href: '/c/women', targetLive: false, children: [{ id: 'a2', label: 'Stitched', href: '/c/stitched', targetLive: true }] }, { id: 'a3', label: 'Sale', href: '/sale', targetLive: true }]
    const nodes = fromApi(api)
    expect(nodes[0]).toMatchObject({ key: 'a1', targetLive: false })
    expect(toApi([...nodes, { key: 'n', label: ' New ', href: ' /new ', children: [] }])).toEqual([
      { id: 'a1', label: 'Women', href: '/c/women', children: [{ id: 'a2', label: 'Stitched', href: '/c/stitched' }] },
      { id: 'a3', label: 'Sale', href: '/sale' },
      { label: 'New', href: '/new' },
    ])
  })
})
