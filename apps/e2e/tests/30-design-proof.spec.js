// The design proofs of plan/06-storefront/15-design-system-v2.md section 9: the type of the main pages against the scale, nothing below 12 px, the motion under reduced motion, the specimen page.
// REQ: VD-01, VD-02, VD-03
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

/** The computed look of the first element that matches, or undefined. @param {import('@playwright/test').Page} page @param {string} selector */
const look = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return undefined
    const s = getComputedStyle(el)
    return { size: Number.parseFloat(s.fontSize), family: s.fontFamily, weight: s.fontWeight }
  }, selector)

/** Phone and desktop sizes of each scale step (DOC-06.15 section 4.1), with a pixel of rounding either way. */
const scale = { h1: [30, 44], h2: [24, 32] }

for (const [width, index] of /** @type {const} */ ([[390, 0], [1280, 1]])) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('the page title, the section titles and the product name follow the type scale', async ({ page }) => {
      await page.goto('/c/stitched')
      const h1 = await look(page, 'main h1')
      expect(h1?.size).toBeGreaterThanOrEqual((scale.h1[index] ?? 0) - 1)
      expect(h1?.size).toBeLessThanOrEqual((scale.h1[index] ?? 0) + 1)
      expect(h1?.family).toContain('Playfair')
      const name = await look(page, 'article a span.text-ui')
      expect(name?.size).toBe(15)
      expect(name?.family).toContain('Inter')
      await page.goto('/')
      await page.locator('#home-new').scrollIntoViewIfNeeded()
      const h2 = await look(page, '#home-new')
      expect(h2?.size).toBeGreaterThanOrEqual((scale.h2[index] ?? 0) - 1)
      expect(h2?.size).toBeLessThanOrEqual((scale.h2[index] ?? 0) + 1)
    })

    test('no text on the main pages is smaller than 12 px', async ({ page }) => {
      for (const path of ['/', '/c/stitched', '/p/cotton-kurta', '/cart', '/search?q=kurta', '/design']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const small = await page.evaluate(() => {
          const found = /** @type {string[]} */ ([])
          for (const el of document.querySelectorAll('main *, header *, footer *')) {
            const direct = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
            if (!direct || el.closest('[aria-hidden="true"]')) continue
            const s = getComputedStyle(el)
            if (s.display === 'none' || s.visibility === 'hidden') continue
            if (Number.parseFloat(s.fontSize) < 12) found.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${s.fontSize}`)
          }
          return found.slice(0, 5)
        })
        expect(small, `${path} at ${width} px`).toEqual([])
      }
    })
  })
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('no transition or animation on the interface lasts longer than 0 ms', async ({ page }) => {
    for (const path of ['/', '/c/stitched']) {
      await page.goto(path)
      const longest = await page.evaluate(() => {
        const ms = (/** @type {string} */ v) => Math.max(0, ...v.split(',').map((x) => (x.trim().endsWith('ms') ? Number.parseFloat(x) : Number.parseFloat(x) * 1000)))
        let worst = 0
        for (const el of document.querySelectorAll('header *, main *, footer *')) {
          const s = getComputedStyle(el)
          worst = Math.max(worst, ms(s.transitionDuration), ms(s.animationDuration))
        }
        return worst
      })
      expect(longest, `${path}`).toBe(0)
    }
  })
})

test('the specimen page shows the tokens, and is clean for a screen reader', async ({ page }) => {
  await page.goto('/design')
  await expect(page.getByRole('heading', { level: 1, name: 'Design specimen' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Type' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Primary' })).toBeVisible()
  await expectNoViolations(page)
})
