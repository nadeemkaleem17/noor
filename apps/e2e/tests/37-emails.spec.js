// The order emails managed in the admin (plan/17-owner-requests-2026-10.md item 13): an event switched off, own wording with a preview, a test message and the log.
// No mail server is set up in these runs, so a test message is written to the log as "Not sent" and the screen says so.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('staff write their own order email, see it filled in, send a test, and find it in the log', async ({ page }) => {
  const api = await adminApi()
  const before = await api.get('/admin/settings/store')
  try {
    await page.goto(`${urls.admin}/settings/emails`)
    await expect(page.getByRole('heading', { name: 'Emails', level: 1 })).toBeVisible()
    await expect(page.getByText(/No mail server is set up on this server/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6)

    const row = page.getByRole('heading', { name: 'Order dispatched' }).locator('xpath=ancestor::li[1]')
    await row.getByRole('button', { name: 'Edit the wording' }).click()
    await row.getByLabel('Subject').fill('On its way, {{name}}')
    await row.getByLabel('Message').fill('Order {{orderNo}} left the shop. Courier: {{courier}}, tracking {{tracking}}.')
    await row.getByRole('button', { name: 'Preview' }).click()
    const preview = row.getByRole('region', { name: 'Preview' })
    await expect(preview).toContainText('On its way,')
    await expect(preview).toContainText('left the shop')
    await expect(preview).not.toContainText('{{')
    await expectNoViolations(page)

    // an event switched off, and the wording saved with the card
    await page.getByRole('switch', { name: 'Send "Order returned"' }).click()
    await page.getByRole('button', { name: 'Save emails' }).click()
    await expect(page.getByText('Emails saved').first()).toBeVisible()
    const saved = await api.get('/admin/settings/store')
    expect(saved.value.emails.events.returned.enabled).toBe(false)
    expect(saved.value.emails.events.dispatched.subject).toBe('On its way, {{name}}')

    // a test message: no mail server, so it is written down and the screen says so
    await row.getByLabel('Send a test to').fill('owner@example.com')
    await row.getByRole('button', { name: 'Send the test' }).click()
    await expect(page.getByText(/No mail server is set up, so nothing was sent/).first()).toBeVisible()
    await page.reload()
    const log = page.getByRole('table', { name: 'Email log' })
    await expect(log.getByText('owner@example.com').first()).toBeVisible()
    await expect(log.getByText('Not sent (no mail server)').first()).toBeVisible()
  } finally {
    // the settings as they were, so a second run starts the same
    const now = await api.get('/admin/settings/store')
    await api.put('/admin/settings/store', { value: before.value, version: now.version })
    await api.dispose()
  }
})
