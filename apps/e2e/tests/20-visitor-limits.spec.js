// Not one of the 17 journeys (M7-09): the API's limits count visitors, not the shop's server. Ten lookups of an order in an hour is the limit for one address; the eleventh
// REQ: SC-01
// from one visitor is refused, while a second visitor, through the same shop server at the same moment, is answered as usual.
import { expect, test } from '../support/test.js'

const notFound = 'We could not find an order with that number and mobile number.'
const busy = 'Too many attempts. Try again in a few minutes or WhatsApp us.'

/** Looks one order up on the track page and says which of the two answers came back. @param {import('@playwright/test').Page} page @param {number} n */
async function look(page, n) {
  await page.goto('/track')
  await page.getByLabel('Order number').fill(`RB-9${String(n).padStart(5, '0')}`)
  await page.getByLabel('Mobile number').fill('0300 0000000')
  await page.getByRole('button', { name: 'Track order' }).click()
  const answer = page.getByText(new RegExp(`${notFound}|${busy.slice(0, 20)}`))
  await expect(answer).toBeVisible()
  return (await answer.textContent()) ?? ''
}

test('visitor limits: the eleventh lookup of one visitor is refused, another visitor is not', async ({ browser }) => {
  test.setTimeout(120_000)
  const one = await (await browser.newContext()).newPage()
  const two = await (await browser.newContext()).newPage()
  const run = Math.floor(Math.random() * 90) // another order number each run: one number may be tried only five times an hour
  const answers = []
  for (let i = 0; i < 11; i++) answers.push(await look(one, run * 100 + i))
  expect(answers.slice(0, 10).every((a) => a.includes('could not find'))).toBe(true)
  expect(answers[10]).toContain('Too many attempts')

  // the same server, a different visitor, straight after: not limited
  expect(await look(two, run * 100 + 50)).toContain('could not find')
  // and the first visitor is still limited
  expect(await look(one, run * 100 + 51)).toContain('Too many attempts')
})
