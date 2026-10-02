import { describe, expect, it } from 'vitest'
import { findPhysical } from '../logical.js'

const hit = (code, file = 'a.tsx') => findPhysical(code, file).length > 0

describe('physical-direction check', () => {
  it.each([
    '<div className="ml-4 p-2">', '<div className="pr-2">', '<div className="absolute left-0 top-0">', '<div className="-mr-1">',
    '<div className="md:ml-4">', '<div className="text-left">', '<div className="border-l">', '<div className="rounded-r-md">',
    '<div className="float-right">', 'const s = { left: 0 }',
  ])('flags %s', (code) => expect(hit(code)).toBe(true))

  it.each([
    '<div className="ms-4 pe-2 text-start">', '<div className="start-0 end-2">', '<div className="border-s rounded-s-control">',
    '<div className="rounded-control text-fg">', '<div className="p-4 px-2 pt-1">', 'const leftover = items.length',
    '<div className="inset-x-0">', 'const label = "Bottom left corner"',
  ])('allows %s', (code) => expect(hit(code)).toBe(false))

  it('flags physical CSS properties', () => {
    for (const css of ['margin-left: 4px;', 'padding-right: 1rem;', 'text-align: left;', 'float: right;', 'left: 0;', 'border-left: 1px solid;', 'border-top-left-radius: 4px;']) {
      expect(hit(css, 'a.css'), css).toBe(true)
    }
    for (const css of ['margin-inline-start: 4px;', 'inset-inline-start: 0;', 'text-align: start;', 'border-inline-start: 1px solid;']) {
      expect(hit(css, 'a.css'), css).toBe(false)
    }
  })

  it('ignores comments but still checks code on the same line', () => {
    expect(hit('/** Utilities that must flip in right-to-left layouts. */')).toBe(false)
    expect(hit('// left-aligned in the old design')).toBe(false)
    expect(hit(' * the left-hand column')).toBe(false)
    expect(hit('<div className="ms-4"> {/* was ml-4 */}')).toBe(false)
    expect(hit('<div className="ml-4"> // old')).toBe(true)
  })

  it('skips a line that carries a physical: reason', () => {
    expect(hit('<div className="left-1/2 -translate-x-1/2"> {/* physical: centred, identical in RTL */}')).toBe(false)
    expect(findPhysical('a\n<div className="ml-4">\nb', 'a.tsx')).toEqual([{ line: 2, text: '<div className="ml-4">' }])
  })
})
