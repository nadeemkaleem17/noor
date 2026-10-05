import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000008${String(n).padStart(2, '0')}`
const emptyHome = () => ({ announcement: { text: '' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: '' } })
const doc = (/** @type {Record<string, unknown>} */ value = {}, version = 0, images = {}) => ({ value: { ...emptyHome(), ...value }, version, images })
const slide = { id: 's1', mediaId: u(1), alt: 'Lawn collection', heading: 'Eid Edit', buttonText: 'Shop', buttonHref: '/collections/eid-edit' }
const image = { src: 'http://localhost:3000/img/s1.jpg', srcset: '', width: 1600, height: 900, alt: '' }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({ 'GET /admin/me': () => json(200, me({ permissions })) })

describe('home page content (plan/07-admin/09-content.md section 2)', () => {
  it('saves the whole document with its version, leaving out what was not filled in', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc({}, 0)), 'PUT /admin/content/home': ({ body }) => ((sent = body), json(200, doc(body.value, 1))) })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Text', { selector: 'input[name="announcement.text"]' }), 'Free delivery over Rs. 5,000')
    await user.type(screen.getByLabelText('About text'), 'Rubaya makes clothes.')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toEqual({
      value: { announcement: { text: 'Free delivery over Rs. 5,000' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: 'Rubaya makes clothes.' } },
      version: 0,
    })
    expect((await screen.findAllByText('Home page saved')).length).toBeGreaterThan(0)
  })

  it('refuses a slide with a link but no button text, and says where', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc({ heroSlides: [{ id: 's1', mediaId: u(1), alt: 'Lawn', heading: 'Eid Edit' }] }, 2, { [u(1)]: image })) })
    const { user } = renderApp('/content/home')
    await screen.findByText('Slide 1')
    await user.type(within(/** @type {HTMLElement} */ (document.getElementById('hero'))).getByLabelText('Button link'), '/collections/eid-edit')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('This field is required')).length).toBeGreaterThan(0)
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('refuses javascript: as a link', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc()) })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Link', { selector: 'input[name="announcement.href"]' }), 'javascript:alert(1)')
    await user.type(screen.getByLabelText('Text', { selector: 'input[name="announcement.text"]' }), 'Sale')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid link')).toBeTruthy()
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('suggests the shop\'s own pages as the link is typed', async () => {
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc()),
      'GET /admin/links': () => json(200, { items: [{ type: 'category', label: 'Women', href: '/c/women' }, { type: 'page', label: 'Shipping & returns', href: '/pages/shipping-returns' }] }),
    })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Link', { selector: 'input[name="announcement.href"]' }), 'wom')
    await waitFor(() => expect(document.querySelectorAll('datalist option').length).toBe(2), { timeout: 5000 })
    expect([...document.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['/c/women', '/pages/shipping-returns'])
  })

  it('shows a slide with both crops of its picture, and moves slides', async () => {
    const second = { ...slide, id: 's2', mediaId: u(2), heading: 'Winter' }
    fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc({ heroSlides: [slide, second] }, 3, { [u(1)]: image, [u(2)]: { ...image, src: 'http://localhost:3000/img/s2.jpg' } })) })
    const { user } = renderApp('/content/home')
    expect((await screen.findAllByLabelText('How the picture is cropped')).length).toBe(2)
    expect(screen.getAllByText('Phone, 4:5').length).toBe(2)
    await user.click(screen.getByRole('button', { name: 'Move slide 2 up' }))
    const hero = /** @type {HTMLElement} */ (document.getElementById('hero'))
    const headings = within(hero).getAllByLabelText(/^Heading/).map((i) => /** @type {HTMLInputElement} */ (i).value)
    expect(headings).toEqual(['Winter', 'Eid Edit'])
  })

  it('offers "Overwrite with mine" on a stale save and sends the fresh version', async () => {
    /** @type {any[]} */
    const puts = []
    let reads = 0
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc({}, reads++ === 0 ? 2 : 5)),
      'PUT /admin/content/home': ({ body }) => (puts.push(body), body.version === 2 ? problem(409, 'stale_write', { currentVersion: 5 }) : json(200, doc(body.value, 6))),
    })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('About text'), 'Mine')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this page' })
    await user.click(within(dialog).getByRole('button', { name: 'Overwrite with mine' }))
    await waitFor(() => expect(puts.map((p) => p.version)).toEqual([2, 5]))
  })

  it('is read-only without content:write', async () => {
    fakeApi({ ...session(['dashboard:read', 'content:read']), 'GET /admin/content/home': () => json(200, doc({ heroSlides: [slide] }, 1, { [u(1)]: image })) })
    renderApp('/content/home')
    expect((/** @type {HTMLInputElement} */ (await screen.findByLabelText('About text'))).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a slide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove slide 1' })).toBeNull()
  })
})
