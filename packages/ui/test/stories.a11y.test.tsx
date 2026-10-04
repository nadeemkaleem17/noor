// @vitest-environment jsdom
// The accessibility gate (M2-05): every story in the library is rendered and checked with axe. A story with a missing label,
// a bad role or a duplicated landmark fails `pnpm test`, locally and in CI.
// Page-level rules (landmark "region") do not apply to a single component. jsdom has no layout, so axe's color-contrast rule cannot run here: colors are covered by test/contrast.test.ts (every token pair)
// and by running the Storybook a11y panel in a browser. ponytail: add a Playwright pass in CI when contrast of composed stories matters.
import { composeStories, setProjectAnnotations, type Meta } from '@storybook/react-vite'
import { render } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import preview from '../.storybook/preview'
import './dom'

setProjectAnnotations(preview)

type StoryModule = { default: Meta; [story: string]: unknown }
const modules = import.meta.glob<StoryModule>('../src/**/*.stories.tsx', { eager: true })

const cases = Object.entries(modules).flatMap(([path, mod]) =>
  Object.entries(composeStories(mod as never) as Record<string, React.ComponentType>).map(([name, Story]) => ({ id: `${path.replace('../src/', '')} › ${name}`, Story })),
)

const check = async (container: Element) =>
  (await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations.map(
    (v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)).join(' | ')}`,
  )

describe('axe over every story', () => {
  it('finds stories to check', () => {
    expect(cases.length).toBeGreaterThan(30)
  })

  it('catches a missing label (so the gate can fail)', async () => {
    const { container } = render(<button type="button"><svg aria-hidden /></button>)
    const found = await check(container)
    expect(found.join('\n')).toContain('button-name')
  })

  it.each(cases)('$id has no violations', async ({ Story }) => {
    render(<Story />)
    // overlays render in portals, so check the whole document
    expect(await check(document.body)).toEqual([])
  })
})
