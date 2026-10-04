// Confirms the Tailwind v4 assumptions of plan/04-design-system/tokens.md (its Q-04a-3): `@theme inline`, removing the
// default palette with `--color-*: initial`, logical utilities, and our own breakpoints, by compiling tokens.css for real.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { compile } from '@tailwindcss/node'

const tokensPath = fileURLToPath(new URL('../src/tokens.css', import.meta.url))
/** @type {(classes: string[]) => string} */
let build

beforeAll(async () => {
  const compiler = await compile(readFileSync(tokensPath, 'utf8'), { base: path.dirname(tokensPath), onDependency: () => {} })
  build = (classes) => compiler.build(classes)
}, 60_000)

describe('tokens.css compiled by Tailwind v4', () => {
  it('maps semantic color utilities to the --sem variables', () => {
    const css = build(['bg-surface', 'text-fg', 'border-line-strong', 'text-accent-text', 'bg-sidebar'])
    expect(css).toMatch(/\.bg-surface\s*{[^}]*var\(--sem-surface\)/)
    expect(css).toMatch(/\.text-fg\s*{[^}]*var\(--sem-fg\)/)
    expect(css).toMatch(/\.border-line-strong\s*{[^}]*var\(--sem-line-strong\)/)
    expect(css).toMatch(/\.text-accent-text\s*{[^}]*var\(--sem-accent-text\)/)
    expect(css).toMatch(/\.bg-sidebar\s*{[^}]*var\(--sem-sidebar-bg\)/)
  })

  it('removes Tailwind\'s default palette so a raw color cannot be used', () => {
    const css = build(['bg-red-500', 'text-blue-600', 'bg-gray-100'])
    expect(css).not.toContain('.bg-red-500')
    expect(css).not.toContain('.text-blue-600')
    expect(css).not.toContain('.bg-gray-100')
  })

  it('provides logical-direction utilities (RTL-safe)', () => {
    const css = build(['ms-4', 'pe-2', 'start-0', 'text-start', 'border-s', 'rounded-s-control'])
    expect(css).toContain('margin-inline-start')
    expect(css).toContain('padding-inline-end')
    expect(css).toContain('inset-inline-start')
    expect(css).toContain('text-align: start')
    expect(css).toContain('border-inline-start-width')
  })

  it('maps radius, shadow, font and text-size tokens', () => {
    const css = build(['rounded-control', 'rounded-card', 'shadow-card', 'font-heading', 'text-base', 'text-md'])
    expect(css).toMatch(/\.rounded-control\s*{[^}]*var\(--sem-radius-control\)/)
    expect(css).toMatch(/\.shadow-card/)
    expect(css).toMatch(/\.font-heading\s*{[^}]*var\(--sem-font-heading\)/)
    // non-inline @theme: the value is defined once on :root and the utility refers to it
    expect(css).toMatch(/\.text-base\s*{[^}]*font-size:\s*var\(--text-base\)/)
    expect(css).toMatch(/--text-base:\s*0\.875rem/)
    expect(css).toMatch(/\.text-md\s*{[^}]*font-size:\s*var\(--text-md\)/)
    expect(css).toMatch(/--text-md:\s*1rem/)
  })

  it('uses our breakpoints and z-index utilities', () => {
    const css = build(['md:p-4', 'lg:p-4', 'z-modal', 'z-toast'])
    expect(css).toMatch(/@media \(width >= 48rem\)/)
    expect(css).toMatch(/@media \(width >= 64rem\)/)
    expect(css).toMatch(/\.z-modal\s*{\s*z-index:\s*50/)
    expect(css).toMatch(/\.z-toast\s*{\s*z-index:\s*70/)
  })

  it('keeps durations as plain variables for duration-(--dur-micro)', () => {
    const css = build(['duration-(--dur-micro)'])
    expect(css).toMatch(/transition-duration:\s*var\(--dur-micro\)/)
    expect(css).toContain('--dur-micro: 120ms')
  })
})
