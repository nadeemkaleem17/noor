// The 12 pages of the visual baselines (plan/06-storefront/11-storefront-v2.md §8.2), at the three widths of playwright.visual.config.js.
// Dates and order numbers are masked; motion is off; pictures are the seeded demo pictures (so they do not change between runs).
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

test.describe.configure({ mode: 'serial' })

/** @param {import('@playwright/test').Page} page @param {string} name @param {import('@playwright/test').Locator[]} [mask] */
async function shot(page, name, mask = []) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // The lower sections of a page are `content-visibility: auto` and its pictures `loading=lazy`: the page is only its real height and fully drawn once something has scrolled
  // through it. Scroll to the bottom in screens, wait for every picture, come back to the top.
  await page.evaluate(async () => {
    const step = window.innerHeight
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    // only pictures that are on the page (a hidden one, like the card's hover picture, never loads and would wait forever), each with a time limit
    const shown = [...document.images].filter((i) => i.offsetParent !== null)
    await Promise.all(shown.map((i) => Promise.race([i.decode().catch(() => {}), new Promise((r) => setTimeout(r, 4000))])))
    window.scrollTo(0, 0)
  })
  // a section far from the screen is not painted into a full-page picture while it is `content-visibility: auto` (a tall page lost its middle): draw them all, then wait two frames
  // (a constructed style sheet: the shop's content security policy refuses an inline style element)
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('*{content-visibility:visible!important}')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask })
}

const plain = /** @type {const} */ ([
  ['home', '/'],
  ['category-landing', '/c/women'],
  ['category-leaf', '/c/stitched'],
  ['search-results', '/search?q=kurta'],
  ['search-none', '/search?q=zzqxv'],
  ['product', '/p/cotton-kurta'],
  ['cart-empty', '/cart'],
  ['track', '/track'],
  ['not-found', '/no-such-page'],
])

for (const [name, url] of plain) {
  test(`baseline: ${name}`, async ({ page }) => {
    await page.goto(url)
    await shot(page, name)
  })
}

test('baseline: the bag drawer after an add', async ({ page }) => {
  await page.goto('/p/cotton-kurta')
  await page.getByRole('radio', { name: 'L', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Cotton Kurta').last()).toBeVisible()
  await shot(page, 'bag-drawer')
})

test('baseline: the menu on a phone', async ({ page }, info) => {
  if (info.project.name !== 'phone-390') return // the drawer only exists on a phone
  await page.goto('/')
  await page.getByRole('button', { name: /menu/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'menu-open')
})

test('baseline: the checkout after an empty submit, and the order page', async ({ page }) => {
  await addToCart(page, 'cotton-kurta', 'L')
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.getByLabel('Full name')).toBeFocused()
  await shot(page, 'checkout-errors')
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place order' }).click()
  await orderNumber(page)
  await shot(page, 'order', [page.getByText(/^Order RB-\d+/), page.getByText(/\d{1,2}-\w{3}-\d{4}/), page.getByText(/••••/)])
})
