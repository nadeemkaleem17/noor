// Demo seed: a small working shop for local work, CI and staging (plan/14-devops.md section 5.2). Everything goes through the services, so it
// obeys the same rules as the admin (publish checks, stock ledger, audit). Idempotent: each thing is created only if its handle, code or
// title is not there yet. Never run on production.
import { eq } from 'drizzle-orm'
import { uuidv7 } from '../platform/ids.js'
import { media as mediaTable } from '../db/schema/media.js'
import { products } from '../db/schema/products.js'
import { demoAttributes, demoCategories, demoCharts, demoForms, demoProducts, demoSizeSystems } from './demo-data.js'
import { placeholderImage } from './images.js'

/** @typedef {ReturnType<typeof import('../modules/services.js').createServices>} Services */
/** @typedef {{ staffId: string, name: string, role: string, canPublish: boolean }} Actor */

const rupees = (/** @type {number} */ n) => ({ amount: n * 100, currency: /** @type {const} */ ('PKR') })
const req = () => ({ ip: '127.0.0.1', userAgent: 'seed', requestId: uuidv7() })
const slug = (/** @type {string} */ s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * A picture through the real pipeline: upload slot, bytes into storage, then the same check and resizing an upload gets.
 * @param {import('../platform/db.js').Database['db']} db @param {Services} s @param {Actor} actor @param {Parameters<typeof placeholderImage>[0]} look
 */
async function picture(db, s, actor, look) {
  const bytes = await placeholderImage(look)
  const slot = await s.media.createUpload(actor, { contentType: 'image/jpeg', bytes: bytes.length })
  const row = (await db.select().from(mediaTable).where(eq(mediaTable.id, slot.mediaId)))[0]
  await s.storage.put(/** @type {string} */ (row?.objectKey), bytes)
  await s.media.process(slot.mediaId)
  return slot.mediaId
}

/**
 * @param {import('../platform/db.js').Database['db']} db
 * @param {Services} s
 * @param {Actor} actor
 * @param {{ log?: (line: string) => void }} [opts]
 * @returns {Promise<Record<string, number>>}
 */
export async function seedDemo(db, s, actor, { log = () => {} } = {}) {
  const done = { attributes: 0, categories: 0, sizeSystems: 0, charts: 0, forms: 0, products: 0, collections: 0 }

  // ---- structure ----
  const haveAttrs = new Map((await s.catalog.attributes.list()).items.map((a) => [a.code, a]))
  for (const a of demoAttributes) {
    if (haveAttrs.has(a.code)) continue
    const made = await s.catalog.attributes.create(actor, {
      code: a.code, label: a.label, type: 'enum', display: /** @type {'checkbox' | 'buttons'} */ (a.display), filterable: true, ...(a.group ? { group: a.group } : {}),
      values: a.values.map((v) => ({ code: v.split(':')[0] ?? '', label: v.split(':')[1] ?? '' })),
    }, req())
    haveAttrs.set(a.code, made)
    done.attributes += 1
  }
  const attr = (/** @type {string} */ code) => /** @type {NonNullable<ReturnType<typeof haveAttrs.get>>} */ (haveAttrs.get(code))

  const haveCats = new Map((await s.catalog.categories.list()).items.map((c) => [c.handle, c]))
  for (const c of demoCategories) {
    if (haveCats.has(c.handle)) continue
    const made = await s.catalog.categories.create(actor, {
      name: c.name, handle: c.handle, ...(c.description ? { description: c.description } : {}), ...(c.parent ? { parentId: haveCats.get(c.parent)?.id ?? null } : {}), visible: true,
      attributes: c.filters.map((code, i) => ({ attributeId: attr(code).id, seoIndexable: i === 0, required: false })),
    }, req())
    haveCats.set(c.handle, made)
    done.categories += 1
  }

  const haveSystems = new Map((await s.catalog.sizes.list()).items.map((x) => [x.name, x]))
  for (const sys of demoSizeSystems) {
    if (haveSystems.has(sys.name)) continue
    haveSystems.set(sys.name, await s.catalog.sizes.createSystem(actor, { name: sys.name, values: sys.labels.map((label) => ({ label })) }, req()))
    done.sizeSystems += 1
  }
  const system = (/** @type {string} */ name) => /** @type {NonNullable<ReturnType<typeof haveSystems.get>>} */ (haveSystems.get(name))

  const haveCharts = new Map((await s.catalog.sizes.listCharts()).items.map((x) => [x.title, x]))
  for (const c of demoCharts) {
    if (haveCharts.has(c.title)) continue
    haveCharts.set(c.title, await s.catalog.sizes.createChart(actor, { title: c.title, unit: /** @type {'in'} */ (c.unit), notes: c.notes, sizeSystemId: system(c.system).id, tables: c.tables }, req()))
    done.charts += 1
  }
  const haveForms = new Map((await s.catalog.sizes.listForms()).items.map((x) => [x.title, x]))
  for (const f of demoForms) {
    if (haveForms.has(f.title)) continue
    haveForms.set(f.title, await s.catalog.sizes.createForm(actor, { title: f.title, allowNotes: f.allowNotes, fields: /** @type {never} */ (f.fields) }, req()))
    done.forms += 1
  }
  const chart = [...haveCharts.values()][0]
  const bridalForm = haveForms.get('Bridal measurements')

  // ---- products ----
  const haveHandles = new Set((await db.select({ h: products.handle }).from(products)).map((p) => p.h))
  const made = /** @type {{ id: string, handle: string, spec: (typeof demoProducts)[number], firstMedia?: string }[]} */ ([])
  for (const [i, p] of demoProducts.entries()) {
    const handle = slug(p.title)
    if (haveHandles.has(handle)) continue
    const sku = handle.toUpperCase().replace(/-/g, '').slice(0, 24)
    const mediaIds = [await picture(db, s, actor, { text: p.title, hex: p.hex, caption: 'front' }), await picture(db, s, actor, { text: p.title, hex: p.hex, caption: 'detail' })]
    const sizes = p.sizes && p.system ? system(p.system).values.filter((v) => p.sizes && p.sizes[v.label] !== undefined) : null
    const stitchedAdult = p.system === "Women's stitched"
    const made2o = p.kind === 'made_to_order'
    const customValue = made2o && bridalForm ? [{ key: 'custom', label: 'Custom', kind: /** @type {const} */ ('custom') }] : []
    const mtoSizes = made2o ? system("Women's stitched").values.filter((v) => ['S', 'M', 'L', 'XL'].includes(v.label)) : null
    const sized = sizes ?? mtoSizes
    const variant = (/** @type {string} */ key, /** @type {string[]} */ optionValueKeys, /** @type {string} */ suffix) => ({
      key, sku: `${sku}${suffix}`.slice(0, 40), optionValueKeys, price: rupees(p.price), ...(p.compare ? { compareAt: rupees(p.compare) } : {}),
      stockMode: /** @type {'counted' | 'made_to_order'} */ (p.stock === null || made2o ? 'made_to_order' : 'counted'), maxPerOrder: 10, enabled: true,
    })
    const pieces = p.piece ? Number(p.piece) : 0
    const body = {
      handle, status: /** @type {const} */ ('active'), kind: /** @type {never} */ (p.kind), title: p.title, brand: 'Rubaya', descriptionMd: p.blurb,
      highlights: [p.blurb.split('.')[0] ?? p.blurb], care: p.kind === 'unstitched' ? ['Dry clean recommended'] : ['Gentle machine wash, cold'],
      primaryCategoryId: /** @type {string} */ (haveCats.get(p.cat)?.id), categoryIds: [],
      attributes: [
        ...(p.fabric ? [{ attributeId: attr('fabric').id, valueIds: [attr('fabric').values.find((v) => v.code === p.fabric)?.id ?? ''] }] : []),
        ...(p.piece ? [{ attributeId: attr('piece').id, valueIds: [attr('piece').values.find((v) => v.code === p.piece)?.id ?? ''] }] : []),
        ...(p.occasion ? [{ attributeId: attr('occasion').id, valueIds: [attr('occasion').values.find((v) => v.code === p.occasion)?.id ?? ''] }] : []),
        ...(p.material ? [{ attributeId: attr('material').id, valueIds: [attr('material').values.find((v) => v.code === p.material)?.id ?? ''] }] : []),
      ],
      ...(p.style ? { styleId: p.style } : {}),
      colorway: { label: p.colorway ?? p.color[0]?.toUpperCase() + p.color.slice(1), family: /** @type {never} */ (p.color), swatch: { hex: [p.hex] } },
      media: [{ mediaId: /** @type {string} */ (mediaIds[0]), alt: `${p.title}, front`, role: /** @type {const} */ ('model') }, { mediaId: /** @type {string} */ (mediaIds[1]), alt: `${p.title}, detail`, role: /** @type {const} */ ('detail') }],
      options: sized
        ? [{ name: 'Size', role: /** @type {const} */ ('size'), display: /** @type {const} */ ('buttons'), sizeSystemId: stitchedAdult || made2o ? system("Women's stitched").id : system(/** @type {string} */ (p.system)).id,
            values: [...sized.map((v) => ({ key: v.label, label: v.label, sizeSystemValueId: v.id })), ...customValue] }]
        : [],
      variants: sized ? [...sized.map((v) => variant(v.label, [v.label], `-${v.label.replace(/[^A-Z0-9]/gi, '')}`)), ...(customValue.length ? [variant('custom', ['custom'], '-CUSTOM')] : [])] : [variant('v', [], '')],
      ...(sized && !made2o && chart && stitchedAdult ? { sizeChartId: chart.id } : {}),
      ...(made2o ? { madeToOrder: { leadMinDays: 15, leadMaxDays: 20, returnable: false, depositPercent: 30 }, ...(bridalForm ? { customSizeSchemaId: bridalForm.id } : {}) } : {}),
      ...(p.kind === 'unstitched' ? { components: [
        ...(pieces >= 2 || pieces === 0 ? [{ type: /** @type {const} */ ('shirt'), label: 'Shirt', fabric: p.fabric ?? undefined, quantity: '2.5 m', included: true }] : []),
        ...(pieces >= 2 ? [{ type: /** @type {const} */ ('trouser'), label: 'Trouser', quantity: '2.5 m', included: true }] : []),
        ...(pieces === 1 || pieces === 3 ? [{ type: /** @type {const} */ ('dupatta'), label: 'Dupatta', quantity: '2.5 m', included: true }] : []),
      ] } : {}),
      ...(p.badges ? { badges: /** @type {never} */ (p.badges) } : {}),
      initialStock: sized && !made2o ? Object.entries(p.sizes ?? {}).filter(([, n]) => n > 0).map(([k, n]) => ({ variantKey: k, quantity: n })) : p.stock ? [{ variantKey: 'v', quantity: p.stock }] : [],
    }
    const saved = await s.catalog.products.save(actor, null, /** @type {never} */ (body), req())
    // a believable history: published over the last weeks, with the sales and ranking the spec says
    const daysAgo = (demoProducts.length - i) * 1.5
    await db.update(products).set({ publishedAt: new Date(Date.now() - daysAgo * 86_400_000), ...(p.sales ? { salesCount: p.sales } : {}), ...(p.rank ? { featuredRank: p.rank } : {}) }).where(eq(products.id, saved.id))
    made.push({ id: saved.id, handle, spec: p, firstMedia: mediaIds[0] })
    done.products += 1
    log(`  product ${handle}`)
  }

  // ---- collections ----
  const haveCollections = new Set((await s.catalog.collections.list({ page: 1, size: 100 })).items.map((c) => c.handle))
  const all = (await db.select({ id: products.id, handle: products.handle, at: products.publishedAt, compare: products.compareAtMinMinor, title: products.title }).from(products).where(eq(products.status, 'active')))
  const byNew = [...all].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
  const specs = [
    { handle: 'new-in', title: 'New in', description: 'Just landed.', featured: false, ids: byNew.slice(0, 8).map((x) => x.id) },
    { handle: 'sale', title: 'Sale', description: 'Up to 25% off.', featured: false, ids: all.filter((x) => x.compare !== null).map((x) => x.id) },
    { handle: 'eid-edit', title: 'Eid edit', description: 'Festive formals and bridal.', featured: true, ids: all.filter((x) => /festive|bridal|formal|gown|lehnga/i.test(x.title)).map((x) => x.id) },
  ]
  for (const c of specs) {
    if (haveCollections.has(c.handle)) continue
    await s.catalog.collections.create(actor, { title: c.title, handle: c.handle, description: c.description, status: 'active', featured: c.featured, productIds: c.ids }, req())
    done.collections += 1
  }

  // ---- storefront content: only on a shop whose owner has not filled it in yet ----
  const store = await s.settings.get('store')
  if (!store.value.contact.phone) {
    await s.settings.save(actor, 'store', {
      version: store.version,
      value: {
        ...store.value,
        contact: { whatsapp: '923001234567', phone: '+92 300 1234567', email: 'hello@rubaya.pk', address: 'Shop 12, Main Boulevard, Gulberg III, Lahore', hours: 'Mon–Sat, 10am–8pm', socials: [{ platform: 'instagram', url: 'https://instagram.com/rubaya.pk' }] },
        // the demo shop has made-to-order pieces (bridal), so measurements are on
        features: { ...store.value.features, customSizing: true },
        policies: { returnsDays: 7 },
        dispatchPromise: 'Dispatched within 1–2 working days',
      },
    }, req())
  }
  const home = await s.settings.get('home')
  if (!home.value.heroSlides.length) {
    const hero1 = await picture(db, s, actor, { text: 'Festive collection', hex: '#7A1F2B', caption: 'new season', width: 1600, height: 900 })
    const hero2 = await picture(db, s, actor, { text: 'Summer lawn', hex: '#1F6F6B', caption: 'cool and bright', width: 1600, height: 900 })
    await s.settings.save(actor, 'home', {
      version: home.version,
      value: {
        ...home.value,
        announcement: { text: 'Free delivery on orders over Rs. 5,000', href: '/sale' },
        heroSlides: [
          { id: 'festive', mediaId: hero1, alt: 'Festive collection', heading: 'The Eid edit', subheading: 'Embroidered formals, ready to wear', buttonText: 'Shop now', buttonHref: '/collections/eid-edit' },
          { id: 'lawn', mediaId: hero2, alt: 'Summer lawn', heading: 'Summer lawn', subheading: 'Light fabrics, bold prints', buttonText: 'Shop unstitched', buttonHref: '/c/unstitched' },
        ],
        promo: { enabled: true, eyebrow: 'Sale', heading: 'Up to 25% off', text: 'Selected pieces while stock lasts.', buttonText: 'See the sale', buttonHref: '/sale' },
        footer: { about: 'Rubaya is a Pakistani fashion label for the way women dress here.' },
      },
    }, req())
  }

  await s.search.reindexAll()
  return done
}
