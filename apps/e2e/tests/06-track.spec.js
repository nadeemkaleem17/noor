// E2E-06: tracking an order by number and phone, in three ways of writing the phone; a wrong phone and an unknown number get the same answer (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { recall } from '../support/state.js'

const notFound = 'We could not find an order with that number and mobile number.'

test.describe('E2E-06 tracking @smoke', () => {
  for (const phone of ['0321 7654321', '+92 321 7654321', '0321-7654321']) {
    test(`finds the order with the phone written as ${phone}`, async ({ page }) => {
      const { number } = recall('order')
      await page.goto('/track')
      await page.getByLabel('Order number').fill(number)
      await page.getByLabel('Mobile number').fill(phone)
      await page.getByRole('button', { name: 'Track order' }).click()
      await expect(page).toHaveURL(/\/orders\//)
      await expect(page.getByText(new RegExp(`^Order ${number}`)).first()).toBeVisible()
    })
  }

  test('a wrong phone and an unknown number are refused with the same words', async ({ page }) => {
    const { number } = recall('order')
    const answers = []
    for (const [n, phone] of [[number, '0321 0000000'], ['RB-99999999', '0321 7654321']]) {
      await page.goto('/track')
      await page.getByLabel('Order number').fill(n)
      await page.getByLabel('Mobile number').fill(phone)
      await page.getByRole('button', { name: 'Track order' }).click()
      await expect(page.getByText(notFound)).toBeVisible()
      answers.push(await page.getByRole('alert').first().innerText())
    }
    expect(answers[0]).toBe(answers[1])
    await expect(page).not.toHaveURL(/\/orders\//)
  })
})
