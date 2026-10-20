import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultHomeLayout } from '@noor/contract'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { noticeState } from './components/notices-page'

afterEach(resetApp)

const emptyHome = () => ({ announcement: { text: 'Free delivery' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: 'About' }, layout: defaultHomeLayout })
const notice = (/** @type {string} */ id, /** @type {object} */ over = {}) => ({ id, text: `Message ${id}`, severity: 'info', position: 'bar', palette: 'accent', popupEvery: 'day', active: true, ...over })
const doc = (/** @type {object[]} */ notices, version = 3) => ({ value: { ...emptyHome(), notices }, version, images: {} })
const writer = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read', 'content:write'])
const reader = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = writer) => ({ 'GET /admin/me': () => json(200, me({ permissions })) })

describe('what state a notice is in', () => {
  const at = Date.parse('2026-10-20T10:00:00.000Z')
  it('is Off, Scheduled, Ended or Live, in that order of importance', () => {
    expect(noticeState(/** @type {never} */ (notice('a', { active: false })), at)).toBe('Off')
    expect(noticeState(/** @type {never} */ (notice('a', { startsAt: '2026-10-21T00:00:00.000Z' })), at)).toBe('Scheduled')
    expect(noticeState(/** @type {never} */ (notice('a', { endsAt: '2026-10-19T00:00:00.000Z' })), at)).toBe('Ended')
    expect(noticeState(/** @type {never} */ (notice('a', { startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-31T00:00:00.000Z' })), at)).toBe('Live')
    expect(noticeState(/** @type {never} */ (notice('a')), at)).toBe('Live')
  })
})

describe('the notices screen (plan/17-owner-requests-2026-10.md item 4)', () => {
  it('lists each notice with where it shows, its colour and its state', async () => {
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc([notice('a', { text: 'Eid sale' }), notice('b', { text: 'Holiday', title: 'We are closed', position: 'popup', popupEvery: 'once', palette: 'ink', active: false })])),
    })
    renderApp('/content/notices')
    const table = await screen.findByRole('table', { name: 'Notices' })
    const [first, second] = within(table).getAllByRole('row').slice(1).map((r) => within(r))
    expect(first?.getByText('Eid sale')).toBeTruthy()
    expect(first?.getByText('Strip')).toBeTruthy()
    expect(first?.getByText('Live')).toBeTruthy()
    expect(second?.getByText('We are closed')).toBeTruthy()
    expect(second?.getByText('Popup')).toBeTruthy()
    expect(second?.getByText('Once, then never again')).toBeTruthy()
    expect(second?.getByText('Dark')).toBeTruthy()
    expect(second?.getByText('Off')).toBeTruthy()
  })

  it('adds a popup on top of the latest home page: nothing else on it is changed', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc([notice('a')], 7)),
      'PUT /admin/content/home': ({ body }) => ((sent = body), json(200, { value: body.value, version: 8, images: {} })),
    })
    const { user } = renderApp('/content/notices')
    await user.click(await screen.findByRole('button', { name: 'New notice' }))
    const drawer = await screen.findByRole('dialog', { name: 'New notice' })
    await user.selectOptions(within(drawer).getByLabelText('Where it shows'), 'popup')
    await user.type(within(drawer).getByLabelText(/^Headline/), 'Eid sale')
    await user.type(within(drawer).getByLabelText('Details'), 'Up to 30% off until Sunday.')
    await user.type(within(drawer).getByLabelText('Button text'), 'Shop now')
    await user.type(within(drawer).getByLabelText('Link'), '/sale')
    await user.selectOptions(within(drawer).getByLabelText('Colour'), 'warning')
    await user.selectOptions(within(drawer).getByLabelText('How often one visitor sees it'), 'visit')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.version).toBe(7)
    expect(sent.value.announcement).toEqual({ text: 'Free delivery' })
    expect(sent.value.footer).toEqual({ about: 'About' })
    expect(sent.value.notices).toHaveLength(2)
    expect(sent.value.notices[1]).toMatchObject({ text: 'Eid sale', body: 'Up to 30% off until Sunday.', buttonText: 'Shop now', href: '/sale', position: 'popup', palette: 'warning', popupEvery: 'visit', active: true })
  })

  it('will not save a button without a link, and says so', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc([])) })
    const { user } = renderApp('/content/notices')
    await user.click(await screen.findByRole('button', { name: 'New notice' }))
    const drawer = await screen.findByRole('dialog', { name: 'New notice' })
    await user.selectOptions(within(drawer).getByLabelText('Where it shows'), 'side')
    await user.type(within(drawer).getByLabelText(/^Headline/), 'Hello')
    await user.type(within(drawer).getByLabelText('Button text'), 'Go')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    expect((await within(drawer).findAllByText('This field is required')).length).toBeGreaterThan(0)
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('switches a notice off from its menu without deleting it', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc([notice('a', { text: 'Eid sale' })])),
      'PUT /admin/content/home': ({ body }) => ((sent = body), json(200, { value: body.value, version: 4, images: {} })),
    })
    const { user } = renderApp('/content/notices')
    await user.click(await screen.findByRole('button', { name: 'Actions for Eid sale' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Switch off' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.value.notices).toEqual([expect.objectContaining({ id: 'a', active: false })])
  })

  it('deletes the chosen notices after a confirmation that names them', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'GET /admin/content/home': () => json(200, doc([notice('a', { text: 'One' }), notice('b', { text: 'Two' }), notice('c', { text: 'Three' })])),
      'PUT /admin/content/home': ({ body }) => ((sent = body), json(200, { value: body.value, version: 4, images: {} })),
    })
    const { user } = renderApp('/content/notices')
    await user.click(await screen.findByRole('checkbox', { name: 'Select One' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Three' }))
    await user.click(await screen.findByRole('button', { name: 'Delete selected' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Delete 2 notices\?/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.value.notices.map((/** @type {{ id: string }} */ n) => n.id)).toEqual(['b'])
  })

  it('shows a reader the notices and nothing to change them with', async () => {
    fakeApi({ ...session(reader), 'GET /admin/content/home': () => json(200, doc([notice('a', { text: 'Eid sale' })])) })
    renderApp('/content/notices')
    await screen.findByRole('table', { name: 'Notices' })
    expect(screen.queryByRole('button', { name: 'New notice' })).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('says so when there are none', async () => {
    fakeApi({ ...session(), 'GET /admin/content/home': () => json(200, doc([])) })
    renderApp('/content/notices')
    expect(await screen.findByText('No notices yet')).toBeTruthy()
  })
})
