// M7-05: what stands between a freshly seeded shop and opening it, read from the database (src/launch.js).
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { settings } from '../src/db/schema/content.js'
import { shippingZones } from '../src/db/schema/shipping.js'
import { collectFacts, launchProblems, LOCAL_OWNER, PLACEHOLDER_ZONE } from '../src/launch.js'
import { createServices } from '../src/modules/services.js'
import { runSeed } from '../src/seed/index.js'
import { closeHarness, config, createHarness, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

describe.skipIf(!dbAvailable)('launch check (MySQL)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)

  const problems = async (appEnv = 'production') => launchProblems(await collectFacts({ db: t.db, ...createServices({ db: t.db, config }) }, appEnv))
  const blockers = async (/** @type {string} */ appEnv = "production") => (await problems(appEnv)).filter((p) => p.level === 'blocker').map((p) => p.what)

  it('says what a shop that has only its base seed still lacks', async () => {
    await runSeed({ db: t.migrate.db, config, flags: { baseOnly: true } })
    const found = await blockers()
    expect(found.join('\n')).toMatch(/telephone number is empty/)
    expect(found.join('\n')).toMatch(/WhatsApp number is empty/)
    expect(found.join('\n')).toMatch(/email address is empty/)
    expect(found.join('\n')).toMatch(/address is empty/)
    expect(found.join('\n')).toMatch(/days a customer may return/)
    expect(found.filter((w) => w.includes('placeholders'))).toHaveLength(2) // both seeded zones
    expect(found.join('\n')).toMatch(/no product is published/)
    // what the seed does give: the four pages, cash on delivery, delivery fees
    expect(found.join('\n')).not.toMatch(/page "/)
    expect(found.join('\n')).not.toMatch(/cash on delivery is switched off/)
    expect(found.join('\n')).not.toMatch(/no delivery method/)
  }, 90_000)

  it('is quiet about the shop settings once they are entered and the fees confirmed', async () => {
    const [row] = await t.db.select().from(settings).where(eq(settings.key, 'store'))
    const store = /** @type {any} */ (row?.value)
    await t.db.update(settings).set({
      value: { ...store, contact: { ...store.contact, phone: '+92 42 111 000 111', whatsapp: '923001112223', email: 'help@rubaya.pk', address: 'Shop 4, Liberty Market, Lahore' }, policies: { ...store.policies, returnsDays: 7 } },
    }).where(eq(settings.key, 'store'))
    for (const z of await t.db.select().from(shippingZones)) await t.db.update(shippingZones).set({ name: z.name.replace(` (${PLACEHOLDER_ZONE})`, '') }).where(eq(shippingZones.id, z.id))
    // only the shop itself is left: no product yet
    expect(await blockers()).toEqual(['no product is published'])
  }, 60_000)

  it('refuses the local development owner on a shop that is not local, and only there', async () => {
    const { auth } = createServices({ db: t.db, config })
    await auth.createOwner({ email: LOCAL_OWNER, name: 'Local Owner', password: 'correct horse battery staple' })
    expect((await blockers('production')).join('\n')).toContain(LOCAL_OWNER)
    expect((await blockers('local')).join('\n')).not.toContain(LOCAL_OWNER)
  }, 60_000)
})
