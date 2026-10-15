// NVDA on the product page (plan/13-quality.md section 12.1, the first three rows): the heading is announced as the page's heading level 1, the size choices as radio buttons
// with the sizes as their names, and the add button is reachable with Tab and announced as a button. Checks what was SAID, loosely (a phrase contains a word), never a snapshot of the whole log:
// NVDA's wording changes between versions and a snapshot would fail on every update.
import { nvdaTest as test } from '@guidepup/playwright'
import { expect } from '@playwright/test'

/** Presses Tab until a phrase matches, and returns every phrase heard on the way (at most 80 presses). @param {import('@guidepup/playwright').NVDAPlaywright} nvda @param {RegExp} wanted */
async function tabUntil(nvda, wanted) {
  const heard = []
  for (let i = 0; i < 80; i++) {
    await nvda.press('Tab')
    const phrase = await nvda.lastSpokenPhrase()
    heard.push(phrase)
    if (wanted.test(phrase)) return heard
  }
  throw new Error(`NVDA never said ${wanted}; it said: ${heard.join(' | ')}`)
}

test('NVDA reads the product page: the heading, the sizes and the add button', async ({ page, nvda }) => {
  await page.goto('/p/cotton-kurta', { waitUntil: 'load' })
  await page.getByRole('heading', { level: 1 }).waitFor()
  await nvda.navigateToWebContent()

  // the heading, by moving heading to heading
  let heading = ''
  for (let i = 0; i < 12 && !/Cotton Kurta.*heading.*level 1/i.test(heading); i++) {
    await nvda.nextHeading()
    heading = await nvda.lastSpokenPhrase()
  }
  expect(heading).toMatch(/Cotton Kurta.*heading.*level 1/i)

  // the sizes: a radio button each, named by its size
  const toSizes = await tabUntil(nvda, /radio button/i)
  expect(toSizes.at(-1)).toMatch(/\b(XS|S|M|L|XL)\b/)

  // choose it (until a size is chosen the buy button says "Select Size", which a real run showed): then the button says what it does
  await page.keyboard.press('Space') // not NVDA's Space: it did not check the radio in a real run (the page does accept Space: Chrome and Firefox 157 both check it), and the shop's own keyboard handling is E2E-15's job
  await expect(page.getByRole('radio', { name: /^XS/ })).toBeChecked()

  // the add button
  const toButton = await tabUntil(nvda, /Add to cart.*button|button.*Add to cart/i)
  expect(toButton.at(-1)).toMatch(/Add to cart/i)
})
