import { screen, waitFor, within } from '@testing-library/react'
import { defaultHomeLayout } from '@noor/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000008${String(n).padStart(2, '0')}`
const emptyHome = () => ({ announcement: { text: '' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: '' } })
const doc = (/** @type {Record<string, unknown>} */ value = {}, version = 0, images = {}, liveVersion = 3) => ({ value: { ...emptyHome(), ...value }, version, images, hasDraft: version > 0, liveVersion })
const slide = { id: 's1', mediaId: u(1), alt: 'Lawn collection', heading: 'Eid Edit', buttonText: 'Shop', buttonHref: '/collections/eid-edit' }
const image = { src: 'http://localhost:3000/img/s1.jpg', srcset: '', width: 1600, height: 900, alt: '' }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({ 'GET /admin/me': () => json(200, me({ permissions })) })

describe('home page draft, preview and publish (plan/17-owner-requests-2026-10.md item 3)', () => {
  it('says it is the published page and offers no preview or publish until a draft is saved', async () => {
    fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 0)) })
    renderApp('/content/home')
    expect(await screen.findByText(/looking at the published page/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Preview draft' }).hasAttribute('disabled')).toBe(true)
  })

  it('says it is a draft and offers preview and publish once one is saved', async () => {
    fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 2)) })
    renderApp('/content/home')
    expect(await screen.findByText(/You are editing a/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Preview draft' }).hasAttribute('disabled')).toBe(false)
  })

  it('publishes the draft it showed, with the live version it was made from, after a question', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'GET /admin/content/home/draft': () => json(200, doc({}, 2, {}, 7)),
      'POST /admin/content/home/publish': ({ body }) => ((sent = body), json(200, { value: emptyHome(), version: 8, images: {} })),
    })
    const { user } = renderApp('/content/home')
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(sent).toEqual({ version: 2, liveVersion: 7 }))
    expect((await screen.findAllByText('Home page published')).length).toBeGreaterThan(0)
  })

  it('offers to start again when the published page changed after the draft was made', async () => {
    let discarded = false
    fakeApi({
      ...session(),
      'GET /admin/content/home/draft': () => json(200, doc({}, 2, {}, 7)),
      'POST /admin/content/home/publish': () => problem(409, 'stale_write', { currentVersion: 9 }),
      'DELETE /admin/content/home/draft': () => ((discarded = true), json(200, doc({}, 0, {}, 9))),
    })
    const { user } = renderApp('/content/home')
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Publish' }))
    const conflict = await screen.findByRole('alertdialog', { name: 'The published page changed' })
    await user.click(within(conflict).getByRole('button', { name: 'Start again' }))
    await waitFor(() => expect(discarded).toBe(true))
  })

  it('asks for a preview link and opens the shop with it in a new tab', async () => {
    const opened = /** @type {string[]} */ ([])
    const real = window.open
    window.open = /** @type {never} */ ((/** @type {string} */ url) => (opened.push(url), null))
    try {
      fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 2)), 'POST /admin/content/home/preview-link': () => json(200, { token: '1760000000000.sig', expiresAt: '2026-10-10T10:30:00.000Z' }) })
      const { user } = renderApp('/content/home')
      await user.click(await screen.findByRole('button', { name: 'Preview draft' }))
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]).toMatch(/\/\?preview=1760000000000\.sig$/)
    } finally {
      window.open = real
    }
  })

  it('shows no publish, save or discard to people who may only read', async () => {
    fakeApi({ ...session(['dashboard:read', 'content:read']), 'GET /admin/content/home/draft': () => json(200, doc({}, 2)) })
    renderApp('/content/home')
    await screen.findByText(/You are editing a/)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Throw the draft away' })).toBeNull()
  })
})

describe('home page content (plan/07-admin/09-content.md section 2)', () => {
  it('saves the whole document with its version, leaving out what was not filled in', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 0)), 'PUT /admin/content/home/draft': ({ body }) => ((sent = body), json(200, doc(body.value, 1))) })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Text', { selector: 'input[name="announcement.text"]' }), 'Free delivery over Rs. 5,000')
    await user.type(screen.getByLabelText('About text'), 'Rubaya makes clothes.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toEqual({
      value: { announcement: { text: 'Free delivery over Rs. 5,000' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: 'Rubaya makes clothes.' }, layout: defaultHomeLayout },
      version: 0,
    })
    expect((await screen.findAllByText('Draft saved')).length).toBeGreaterThan(0)
  })

  it('moves, switches off and sizes the sections of the home page, and sends the layout with the rest', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 3)), 'PUT /admin/content/home/draft': ({ body }) => ((sent = body), json(200, doc(body.value, 4))) })
    const { user } = renderApp('/content/home')
    const card = within(await screen.findByRole('region', { name: 'Home page sections' }))
    // the order starts as the shop shows it; New in goes above the category pictures
    expect(card.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Category pictures', 'New in', 'Collections', 'Category blocks', 'Promo band', 'Bestsellers', 'Editorial band'])
    await user.click(card.getByRole('button', { name: 'Move New in up' }))
    expect(card.getAllByRole('heading', { level: 3 })[0]?.textContent).toBe('New in')
    expect(card.getByRole('button', { name: 'Move New in up' }).hasAttribute('disabled')).toBe(true)
    await user.click(card.getByRole('switch', { name: 'Show Bestsellers' }))
    const newIn = card.getAllByRole('listitem')[0] ?? document.body
    await user.type(within(newIn).getByLabelText('Heading'), 'Just landed')
    const count = within(newIn).getByLabelText('How many products')
    await user.clear(count)
    await user.type(count, '6')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.value.layout.order).toEqual(['newIn', 'categories', 'collections', 'categoryBlocks', 'promo', 'bestsellers', 'editorial'])
    expect(sent.value.layout.newIn).toEqual({ enabled: true, heading: 'Just landed', count: 6 })
    expect(sent.value.layout.bestsellers).toMatchObject({ enabled: false, count: 8 })
  })

  it('refuses a number of products the shop cannot show', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({}, 3)) })
    const { user } = renderApp('/content/home')
    const card = within(await screen.findByRole('region', { name: 'Home page sections' }))
    const count = card.getAllByLabelText('How many products')[0] ?? document.body
    await user.clear(count)
    await user.type(count, '40')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findAllByText(/too large|too big|Too|between|at most|large/i)).length).toBeGreaterThan(0)
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('refuses a slide with a link but no button text, and says where', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({ heroSlides: [{ id: 's1', mediaId: u(1), alt: 'Lawn', heading: 'Eid Edit' }] }, 2, { [u(1)]: image })) })
    const { user } = renderApp('/content/home')
    await screen.findByText('Slide 1')
    await user.type(within(/** @type {HTMLElement} */ (document.getElementById('hero'))).getByLabelText('Button link'), '/collections/eid-edit')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findAllByText('This field is required')).length).toBeGreaterThan(0)
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('refuses javascript: as a link', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc()) })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Link', { selector: 'input[name="announcement.href"]' }), 'javascript:alert(1)')
    await user.type(screen.getByLabelText('Text', { selector: 'input[name="announcement.text"]' }), 'Sale')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Enter a valid link')).toBeTruthy()
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('suggests the shop\'s own pages as the link is typed', async () => {
    fakeApi({
      ...session(),
      'GET /admin/content/home/draft': () => json(200, doc()),
      'GET /admin/links': () => json(200, { items: [{ type: 'category', label: 'Women', href: '/c/women' }, { type: 'page', label: 'Shipping & returns', href: '/pages/shipping-returns' }] }),
    })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('Link', { selector: 'input[name="announcement.href"]' }), 'wom')
    await waitFor(() => expect(document.querySelectorAll('datalist option').length).toBe(2), { timeout: 5000 })
    expect([...document.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'))).toEqual(['/c/women', '/pages/shipping-returns'])
  })

  it('shows a slide with both crops of its picture, and moves slides', async () => {
    const second = { ...slide, id: 's2', mediaId: u(2), heading: 'Winter' }
    fakeApi({ ...session(), 'GET /admin/content/home/draft': () => json(200, doc({ heroSlides: [slide, second] }, 3, { [u(1)]: image, [u(2)]: { ...image, src: 'http://localhost:3000/img/s2.jpg' } })) })
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
      'GET /admin/content/home/draft': () => json(200, doc({}, reads++ === 0 ? 2 : 5)),
      'PUT /admin/content/home/draft': ({ body }) => (puts.push(body), body.version === 2 ? problem(409, 'stale_write', { currentVersion: 5 }) : json(200, doc(body.value, 6))),
    })
    const { user } = renderApp('/content/home')
    await user.type(await screen.findByLabelText('About text'), 'Mine')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this page' })
    await user.click(within(dialog).getByRole('button', { name: 'Overwrite with mine' }))
    await waitFor(() => expect(puts.map((p) => p.version)).toEqual([2, 5]))
  })

  it('is read-only without content:write', async () => {
    fakeApi({ ...session(['dashboard:read', 'content:read']), 'GET /admin/content/home/draft': () => json(200, doc({ heroSlides: [slide] }, 1, { [u(1)]: image })) })
    renderApp('/content/home')
    expect((/** @type {HTMLInputElement} */ (await screen.findByLabelText('About text'))).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a slide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove slide 1' })).toBeNull()
  })
})
