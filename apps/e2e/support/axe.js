// axe-core on the page as it is now (plan/13-quality.md section 7): a failure names the rule and the elements, not a page of JSON.
import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

/**
 * `target-size` (WCAG 2.2, 2.5.8) is kept, with one exception: an element that is below the fold and reported only as "partially obscured". axe cannot
 * look through the page at a place that is not on the screen, and says so differently from one run to the next (the same link passes and fails on two loads
 * of the same page); a target that is really too small is reported by its size and is not skipped.
 * @param {import('@playwright/test').Page} page
 */
export async function expectNoViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const real = violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => v.id !== 'target-size' || !n.any.some((c) => /partially obscured/.test(c.message))),
    }))
    .filter((v) => v.nodes.length > 0)
  expect(real.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)).toEqual([])
}
