import { describe, expect, it } from 'vitest'
import { cn } from '../src/cn'

describe('cn', () => {
  it('lets later utilities win over conflicting earlier ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('bg-surface', 'bg-accent')).toBe('bg-accent')
    expect(cn('ms-2', 'ms-4')).toBe('ms-4')
  })
  it('keeps non-conflicting classes and drops falsy values', () => {
    const off = /** @type {boolean} */ (false)
    expect(cn('px-4', off && 'x', undefined, 'py-2', { 'text-fg': true, 'text-muted': false })).toBe('px-4 py-2 text-fg')
  })
  it('understands our tokens: same group conflicts, different groups do not', () => {
    expect(cn('rounded-control', 'rounded-card')).toBe('rounded-card')
    expect(cn('text-fg', 'text-muted')).toBe('text-muted')
    expect(cn('text-base', 'text-md')).toBe('text-md')
    expect(cn('text-md', 'text-fg')).toBe('text-md text-fg') // a size and a color must both survive
    expect(cn('shadow-card', 'shadow-pop')).toBe('shadow-pop')
    expect(cn('font-heading', 'font-body')).toBe('font-body')
    expect(cn('z-modal', 'z-popover')).toBe('z-popover')
    expect(cn('text-md', 'leading-urdu')).toBe('text-md leading-urdu')
  })
})
