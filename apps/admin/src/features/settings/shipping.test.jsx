import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const uid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const z = { major: uid(1), rest: uid(2) }
const c = { lahore: uid(11), karachi: uid(12), multan: uid(13), quetta: uid(14) }
const method = (/** @type {number} */ n, label = 'Standard', fee = 25000) => ({ id: uid(100 + n), label, fee: { amount: fee, currency: 'PKR' }, freeAbove: { amount: 500000, currency: 'PKR' }, etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true })
const city = (/** @type {string} */ id, /** @type {string} */ name, /** @type {string} */ province, /** @type {{ id: string; name: string; } | undefined} */ zone, aliases = /** @type {string[]} */ ([])) => ({ id, name, province, aliases, isMajor: false, zone })
const cities = () => [
  city(c.lahore, 'Lahore', 'Punjab', { id: z.major, name: 'Major cities' }),
  city(c.karachi, 'Karachi', 'Sindh', { id: z.major, name: 'Major cities' }),
  city(c.multan, 'Multan', 'Punjab', { id: z.rest, name: 'Rest of Pakistan' }, ['Mooltan']),
  city(c.quetta, 'Quetta', 'Balochistan', undefined),
]
const zones = () => [
  { id: z.major, name: 'Major cities', version: 4, cityCount: 2, cities: [{ id: c.karachi, name: 'Karachi' }, { id: c.lahore, name: 'Lahore' }], methods: [method(1), method(2, 'Express', 45000)] },
  { id: z.rest, name: 'Rest of Pakistan', version: 2, cityCount: 1, cities: [{ id: c.multan, name: 'Multan' }], methods: [method(3, 'Standard', 35000)] },
]
const courier = { id: uid(200), name: 'TCS', trackingUrlPattern: 'https://tcs.example/t/{tracking}', trackingRequired: true, enabled: true, sortOrder: 0 }
const storeValue = () => ({
  brand: { name: 'Rubaya' },
  contact: { socials: [] },
  priceDisplay: { showDecimals: false, rounding: 'none' },
  orderNumberPrefix: 'RB',
  locale: { default: 'en', supported: ['en'] },
  features: { wishlist: true, reviews: true, notifyMe: true, customSizing: true },
  navigation: { mode: 'automatic' },
  popularSearches: [],
  policies: { returnsDays: 7 },
  seo: {},
  notifications: { staffEmails: [] },
  thresholds: { lowStock: 3, highValueCodMinor: 2_500_000 },
  dispatchPromise: 'Dispatched in 2 days',
})
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'settings:read', 'settings:write'])

/** @param {{ permissions?: import('@noor/contract').Permission[]; impact?: object; }} [o] */
function server({ permissions = perms, impact = { citiesRemoved: 0, citiesMovedIn: [], openCarts: 0 } } = {}) {
  const sent = { zonePuts: /** @type {any[]} */ ([]), cityPosts: /** @type {any[]} */ ([]), courierPosts: /** @type {any[]} */ ([]), courierPuts: /** @type {any[]} */ ([]), storePuts: /** @type {any[]} */ ([]), impacts: /** @type {any[]} */ ([]), matches: /** @type {any[]} */ ([]) }
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/shipping/zones': () => json(200, { items: zones(), unassignedCityCount: 1 }),
    'GET /admin/shipping/cities': () => json(200, { items: cities(), total: 4, page: 1, size: 100 }),
    'GET /admin/couriers': () => json(200, { items: [courier] }),
    'GET /admin/settings/store': () => json(200, { value: storeValue(), version: 6, images: {} }),
    [`POST /admin/shipping/zones/${z.rest}/impact`]: ({ body }) => (sent.impacts.push(body), json(200, impact)),
    [`PUT /admin/shipping/zones/${z.major}`]: ({ body }) => (sent.zonePuts.push(body), json(200, zones()[0])),
    [`PUT /admin/shipping/zones/${z.rest}`]: ({ body }) => (sent.zonePuts.push(body), json(200, zones()[1])),
    [`POST /admin/shipping/zones/${z.major}/impact`]: ({ body }) => (sent.impacts.push(body), json(200, impact)),
    'POST /admin/shipping/cities': ({ body }) => (sent.cityPosts.push(body), json(201, city(uid(15), body.name, body.province, undefined, body.aliases))),
    'POST /admin/shipping/cities/match': ({ body }) => {
      sent.matches.push(body)
      const found = body.names.flatMap((/** @type {string} */ n) => cities().filter((x) => x.name.toLowerCase() === n.toLowerCase()).map((x) => ({ input: n, city: x })))
      return json(200, { matched: found, unknown: body.names.filter((/** @type {string} */ n) => !found.some((/** @type {any} */ f) => f.input === n)) })
    },
    'POST /admin/couriers': ({ body }) => (sent.courierPosts.push(body), json(201, { ...courier, ...body, id: uid(201), sortOrder: 1 })),
    [`PUT /admin/couriers/${courier.id}`]: ({ body }) => (sent.courierPuts.push(body), json(200, { ...courier, ...body })),
    'PUT /admin/settings/store': ({ body }) => (sent.storePuts.push(body), json(200, { value: body.value, version: body.version + 1, images: {} })),
  })
  return sent
}
const section = (/** @type {string} */ id) => within(/** @type {HTMLElement} */ (document.getElementById(id)))
const drawer = () => within(screen.getByRole('dialog'))

describe('shipping (plan/07-admin/10-shipping-payments.md section 2)', () => {
  it('lists zones with their methods and the count of cities that are in no zone', async () => {
    server()
    renderApp('/settings/shipping')
    await screen.findByRole('table', { name: 'Delivery zones' })
    const zonesCard = section('zones')
    expect(zonesCard.getByText('Karachi, Lahore')).toBeTruthy()
    expect(zonesCard.getByText(/Standard: 3–5 days, Rs\.? ?250/)).toBeTruthy()
    expect(zonesCard.getByText(/Express: 3–5 days, Rs\.? ?450/)).toBeTruthy()
    expect(zonesCard.getByText('1', { selector: 'strong' })).toBeTruthy()
  })

  it('"Show them" narrows the city list to the cities in no zone', async () => {
    const { user } = (server(), renderApp('/settings/shipping'))
    await screen.findByRole('table', { name: 'Delivery zones' })
    expect(section('cities').getByText('Lahore')).toBeTruthy()
    await user.click(section('zones').getByRole('button', { name: 'Show them' }))
    expect(section('cities').queryByText('Lahore')).toBeNull()
    expect(section('cities').getByText('Quetta')).toBeTruthy()
  })

  it('edits a zone: sends every city of the zone, the whole method list and the version', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit Rest of Pakistan' }))
    const fee = await screen.findByLabelText('Fee for method 1')
    await user.clear(fee)
    await user.type(fee, '400')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent.zonePuts).toHaveLength(1))
    expect(sent.zonePuts[0]).toMatchObject({ version: 2, name: 'Rest of Pakistan', cityIds: [c.multan] })
    expect(sent.zonePuts[0].methods).toHaveLength(1)
    expect(sent.zonePuts[0].methods[0]).toMatchObject({ id: uid(103), label: 'Standard', fee: { amount: 40000, currency: 'PKR' }, freeAbove: { amount: 500000, currency: 'PKR' } })
    expect(sent.impacts).toHaveLength(1) // asked first; nothing changed hands, so no confirmation
  })

  it('offers "Move here" for a city in another zone and confirms the effect before saving', async () => {
    const sent = server({ impact: { citiesRemoved: 0, citiesMovedIn: [{ city: 'Lahore', fromZone: 'Major cities' }], openCarts: 2 } })
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit Rest of Pakistan' }))
    await user.type(await screen.findByLabelText('Search cities'), 'lah')
    await user.click(drawer().getByRole('button', { name: 'Move Lahore here' }))
    expect(drawer().getByText('Lahore (moves from Major cities)')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm.textContent).toContain('Lahore (from Major cities)')
    expect(confirm.textContent).toContain('2 open carts and 0 open orders')
    expect(sent.zonePuts).toHaveLength(0)
    await user.click(within(confirm).getByRole('button', { name: 'Save the zone' }))
    await waitFor(() => expect(sent.zonePuts).toHaveLength(1))
    expect([...sent.zonePuts[0].cityIds].sort()).toEqual([c.lahore, c.multan].sort())
  })

  it('a pasted list adds the cities it knows and leaves the unknown names for correction', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit Rest of Pakistan' }))
    const box = await screen.findByLabelText('Paste a list')
    await user.type(box, 'Quetta, Atlantis')
    await user.click(drawer().getByRole('button', { name: 'Add the pasted cities' }))
    expect(await drawer().findByText(/Not in the city list: Atlantis/)).toBeTruthy()
    expect((/** @type {HTMLTextAreaElement} */ (box)).value).toBe('Atlantis')
    expect(sent.matches[0].names).toEqual(['Quetta', 'Atlantis'])
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent.zonePuts).toHaveLength(1))
    expect([...sent.zonePuts[0].cityIds].sort()).toEqual([c.multan, c.quetta].sort())
  })

  it('refuses a zone whose methods are all off, and a method that is faster than it is slow', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit Rest of Pakistan' }))
    await user.click(await screen.findByRole('switch', { name: 'Enabled' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await drawer().findByText('A zone needs at least one enabled method.')).toBeTruthy()
    expect(sent.zonePuts).toHaveLength(0)
  })

  it('explains an API refusal that would leave no deliverable city', async () => {
    fakeApi({
      'GET /admin/me': () => json(200, me({ permissions: perms })),
      'GET /admin/shipping/zones': () => json(200, { items: zones(), unassignedCityCount: 0 }),
      'GET /admin/shipping/cities': () => json(200, { items: cities(), total: 4, page: 1, size: 100 }),
      'GET /admin/couriers': () => json(200, { items: [] }),
      'GET /admin/settings/store': () => json(200, { value: storeValue(), version: 6, images: {} }),
      [`POST /admin/shipping/zones/${z.rest}/impact`]: () => json(200, { citiesRemoved: 0, citiesMovedIn: [], openCarts: 0 }),
      [`PUT /admin/shipping/zones/${z.rest}`]: () => problem(409, 'no_deliverable_city'),
    })
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit Rest of Pakistan' }))
    await user.type(await screen.findByLabelText('Search cities'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('This would leave no city that customers can order to.')).length).toBeGreaterThan(0)
  })

  it('adds a city with other spellings', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    await screen.findByRole('table', { name: 'Delivery zones' })
    await user.click(section('cities').getByRole('button', { name: 'New city' }))
    await user.type(await screen.findByLabelText(/^Name/), 'Faisalabad')
    await user.selectOptions(screen.getByLabelText('Province'), 'Punjab')
    await user.type(screen.getByLabelText('Other spellings'), 'Lyallpur, Layallpur')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent.cityPosts).toHaveLength(1))
    expect(sent.cityPosts[0]).toEqual({ name: 'Faisalabad', province: 'Punjab', aliases: ['Lyallpur', 'Layallpur'], isMajor: false })
  })

  it('refuses a courier tracking link without {tracking}, then saves a good one', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    await user.click(await screen.findByRole('button', { name: 'Edit TCS' }))
    const link = await screen.findByLabelText('Tracking link')
    await user.clear(link)
    await user.type(link, 'https://tcs.example/track')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid link')).toBeTruthy()
    expect(sent.courierPuts).toHaveLength(0)
    await user.clear(link)
    await user.type(link, 'https://tcs.example/track?id={{tracking}')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent.courierPuts).toHaveLength(1))
    expect(sent.courierPuts[0]).toEqual({ name: 'TCS', trackingUrlPattern: 'https://tcs.example/track?id={tracking}', trackingRequired: true, enabled: true })
  })

  it('saves the dispatch promise and low-stock threshold without touching the COD threshold', async () => {
    const sent = server()
    const { user } = renderApp('/settings/shipping')
    const promise = await screen.findByLabelText('Dispatch promise')
    await user.clear(promise)
    await user.type(promise, 'Dispatched in 1 day')
    await user.click(section('delivery').getByRole('button', { name: /^Save/ }))
    await waitFor(() => expect(sent.storePuts).toHaveLength(1))
    expect(sent.storePuts[0].version).toBe(6)
    expect(sent.storePuts[0].value).toEqual({ ...storeValue(), dispatchPromise: 'Dispatched in 1 day' })
  })

  it('is read-only without settings:write', async () => {
    server({ permissions: ['dashboard:read', 'settings:read'] })
    renderApp('/settings/shipping')
    await screen.findByRole('table', { name: 'Delivery zones' })
    expect(screen.queryByRole('button', { name: 'New zone' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New city' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New courier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete Major cities' })).toBeNull()
    expect((/** @type {HTMLInputElement} */ (await screen.findByLabelText('Dispatch promise'))).readOnly).toBe(true)
  })
})
