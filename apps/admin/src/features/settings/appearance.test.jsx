import { themePresets } from '@noor/contract'
import { themeCss } from '@noor/ui/theme'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const labels = { atelier: 'Atelier', 'storefront-gold': 'Storefront gold', monochrome: 'Monochrome', botanical: 'Botanical', 'rose-garden': 'Rose garden', midnight: 'Midnight', emerald: 'Emerald', sandstone: 'Sandstone', ocean: 'Ocean', lavender: 'Lavender', saffron: 'Saffron', slate: 'Slate' }
const presetList = () => ({ items: Object.entries(themePresets).map(([id, theme]) => ({ id, label: labels[/** @type {keyof typeof labels} */ (id)], theme })) })
const gold = () => structuredClone(themePresets['storefront-gold'])
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'settings:read', 'settings:write'])

/** @param {{ permissions?: import('@noor/contract').Permission[]; value?: any; version?: number; }} [o] */
function server({ permissions = perms, value = gold(), version = 3 } = {}) {
  const state = { puts: /** @type {any[]} */ ([]), doc: { value, version, images: {} } }
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/settings/theme': () => json(200, state.doc),
    'GET /admin/settings/theme/presets': () => json(200, presetList()),
    'PUT /admin/settings/theme': ({ body }) => {
      state.puts.push(body)
      state.doc = { value: body.value, version: body.version + 1, images: {} }
      return json(200, state.doc)
    },
  })
  return state
}
const previewStyles = () => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').filter((t) => t.includes('.theme-preview'))
/** @param {string} label */
const hexOf = (label) => /** @type {HTMLInputElement} */ (screen.getByLabelText(label, { selector: 'input[type="text"], input:not([type])' }))

describe('appearance (plan/07-admin/11-settings.md section 3)', () => {
  it('previews with the storefront\'s own CSS function, aimed at the preview box', async () => {
    server()
    renderApp('/settings/appearance')
    await screen.findByRole('heading', { name: 'Appearance' })
    await waitFor(() => expect(previewStyles().length).toBeGreaterThan(0))
    const expected = themeCss(gold()).replace(':root[data-brand="storefront"]', '.theme-preview[data-brand="storefront"]')
    expect(previewStyles()[0]).toBe(expected)
    expect(document.querySelectorAll('.theme-preview')).toHaveLength(2) // phone and large screen
    expect(within(screen.getByRole('group', { name: 'Preset' })).getByRole('button', { name: /Storefront gold/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('changes the preview when a colour is typed', async () => {
    server()
    const { user } = renderApp('/settings/appearance')
    const accent = await screen.findByLabelText('Accent (buttons)', { selector: 'input[maxlength]' })
    await user.clear(accent)
    await user.type(accent, '#7A1F2B')
    await waitFor(() => expect(previewStyles()[0]).toContain('--sem-accent:#7A1F2B'))
  })

  it('refuses a theme with unreadable text, names the pair and the ratio, and does not call the API', async () => {
    const s = server()
    const { user } = renderApp('/settings/appearance')
    const text = await screen.findByLabelText('Text', { selector: 'input[maxlength]' })
    await user.clear(text)
    await user.type(text, '#C9A227')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This theme cannot be saved')
    expect(alert.textContent).toMatch(/fg on bg is 2\.\d+:1 \(needs 4\.5:1\)/)
    const save = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Save' }))
    expect(save.disabled).toBe(true)
    const panel = /** @type {HTMLElement} */ (document.getElementById('contrast'))
    expect(within(panel).getAllByText('Fails: blocks Save').length).toBeGreaterThan(0)
    expect(s.puts).toHaveLength(0)
  })

  it('"Fix the button text for me" picks black or white, whichever reads better', async () => {
    server()
    const { user } = renderApp('/settings/appearance')
    const onAccent = await screen.findByLabelText('Text on the accent', { selector: 'input[maxlength]' })
    await user.clear(onAccent)
    await user.type(onAccent, '#C9A228')
    await user.click(await screen.findByRole('button', { name: 'Fix the button text for me' }))
    await waitFor(() => expect(/** @type {HTMLInputElement} */ (onAccent).value).toBe('#000000'))
    expect(screen.queryByRole('button', { name: 'Fix the button text for me' })).toBeNull()
  })

  it('warns, but does not block, when the accent is hard to read as text', async () => {
    server()
    const { user } = renderApp('/settings/appearance')
    const accent = await screen.findByLabelText('Accent (buttons)', { selector: 'input[maxlength]' })
    await user.clear(accent)
    await user.type(accent, '#E0D090')
    const row = (await screen.findByText('Accent as text on the page background')).closest('tr')
    expect(within(/** @type {HTMLElement} */ (row)).getByText('Warning')).toBeTruthy()
    expect(screen.queryByText('This theme cannot be saved', { exact: false })).toBeNull()
  })

  it('a preset fills every value; editing one then shows the theme as custom', async () => {
    server()
    const { user } = renderApp('/settings/appearance')
    const gallery = within(await screen.findByRole('group', { name: 'Preset' }))
    expect(gallery.getAllByRole('button')).toHaveLength(Object.keys(themePresets).length)
    expect(gallery.getByRole('button', { name: /Storefront gold/ }).getAttribute('aria-pressed')).toBe('true')
    await user.click(gallery.getByRole('button', { name: /Botanical/ }))
    await waitFor(() => expect(hexOf('Page background').value).toBe(themePresets.botanical.colors.bg))
    expect(gallery.getByRole('button', { name: /Botanical/ }).getAttribute('aria-pressed')).toBe('true')
    await user.clear(hexOf('Accent (buttons)'))
    await user.type(hexOf('Accent (buttons)'), '#123456')
    expect(await screen.findByText('Custom, based on Botanical')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reset to Botanical' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(hexOf('Accent (buttons)').value).toBe(themePresets.botanical.colors.accent))
  })

  it('saves the whole theme with its version', async () => {
    const s = server()
    const { user } = renderApp('/settings/appearance')
    await user.selectOptions(await screen.findByLabelText('Heading font'), 'Inter')
    await user.selectOptions(screen.getByLabelText('Product picture shape'), '1/1')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].version).toBe(3)
    expect(s.puts[0].value.fonts.heading).toBe('Inter')
    expect(s.puts[0].value.mediaRatio).toBe('1/1')
    expect(s.puts[0].value.colors.accent).toBe(themePresets['storefront-gold'].colors.accent)
  })

  it('explains an API refusal over contrast, and handles a stale save', async () => {
    /** @type {any[]} */
    const puts = []
    let reads = 0
    fakeApi({
      'GET /admin/me': () => json(200, me({ permissions: perms })),
      'GET /admin/settings/theme': () => json(200, { value: gold(), version: reads++ === 0 ? 3 : 8, images: {} }),
      'GET /admin/settings/theme/presets': () => json(200, presetList()),
      'PUT /admin/settings/theme': ({ body }) => (puts.push(body), puts.length === 1 ? problem(422, 'theme_contrast_failed') : puts.length === 2 ? problem(409, 'stale_write', { currentVersion: 8 }) : json(200, { value: body.value, version: 9, images: {} })),
    })
    const { user } = renderApp('/settings/appearance')
    await user.selectOptions(await screen.findByLabelText('Heading font'), 'Inter')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Some text would be hard to read. See the contrast check.')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Someone else changed this theme' })).getByRole('button', { name: 'Overwrite with mine' }))
    await waitFor(() => expect(puts.map((p) => p.version)).toEqual([3, 3, 8]))
  })

  it('is read-only without settings:write', async () => {
    server({ permissions: ['dashboard:read', 'settings:read'] })
    renderApp('/settings/appearance')
    expect((await screen.findByLabelText('Accent (buttons)', { selector: 'input[maxlength]' })).hasAttribute('readonly')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})
