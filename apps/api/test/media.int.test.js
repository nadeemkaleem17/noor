// M1-05: uploads end to end through HTTP on a scratch database and a scratch folder (plan/08 section 11, plan/10-api/05 section 3).
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { jobs } from '../src/db/schema/platform.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { media } from '../src/db/schema/media.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { createStorage } from '../src/platform/storage.js'
import { createMediaService, mediaJobs } from '../src/modules/media/index.js'
import { sniff } from '../src/modules/media/images.js'
import { app, closeHarness, config, createHarness, ORIGIN, signedIn, storageDir, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

/** @type {ReturnType<typeof createMediaService>} */
let service
let storage = /** @type {ReturnType<typeof createStorage>} */ (/** @type {unknown} */ (null))

const jpeg = (/** @type {number} */ w, /** @type {number} */ h, exif = false) => {
  const s = sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).jpeg()
  return (exif ? s.withExif({ IFD0: { Copyright: 'secretowner' } }) : s).toBuffer()
}
const png = (/** @type {number} */ w, /** @type {number} */ h) => sharp({ create: { width: w, height: h, channels: 3, background: '#cc3366' } }).png().toBuffer()

/** Asks for a slot, PUTs the bytes to the link like the browser would, confirms, and runs the job the worker would run. */
async function upload(/** @type {Awaited<ReturnType<typeof signedIn>>['b']} */ b, /** @type {Buffer} */ data, { type = 'image/jpeg', bytes = data.length, process = true } = {}) {
  const slot = await b.call('POST', '/admin/media/uploads', { body: { filename: 'photo.jpg', contentType: type, bytes } })
  expect(slot.status, JSON.stringify(slot.body)).toBe(200)
  const url = new URL(slot.body.uploadUrl)
  const put = await app.inject({ method: 'PUT', url: url.pathname + url.search, headers: { ...slot.body.headers, origin: ORIGIN }, payload: data })
  expect(put.statusCode).toBe(200)
  const confirmed = await b.call('POST', `/admin/media/${slot.body.mediaId}/confirm`)
  expect(confirmed.status).toBe(200)
  if (process) await mediaJobs(service)['media.process']?.({ job: { id: 'j', type: 'media.process', payload: { mediaId: slot.body.mediaId }, attempts: 0, maxAttempts: 8 }, signal: new AbortController().signal })
  return { id: /** @type {string} */ (slot.body.mediaId), slot: slot.body, put }
}

describe.skipIf(!dbAvailable)('media (MySQL + local storage, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    storage = createStorage(config)
    service = createMediaService({ db: t.db, config, storage })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(jobs)
    await t.db.delete(media)
    await t.db.delete(staffUsers)
  })

  it('recognises files by their first bytes, not by what they claim to be', async () => {
    expect(sniff((await jpeg(8, 8)).subarray(0, 32))).toBe('image/jpeg')
    expect(sniff((await png(8, 8)).subarray(0, 32))).toBe('image/png')
    expect(sniff(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).webp().toBuffer())).toBe('image/webp')
    expect(sniff(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).avif().toBuffer())).toBe('image/avif')
    for (const text of ['<html><script>alert(1)</script></html>', '<svg xmlns="http://www.w3.org/2000/svg"/>', '%PDF-1.7', 'MZ\u0090\u0000', 'GIF89a']) expect(sniff(Buffer.from(text))).toBeNull()
  })

  describe('a good photo', () => {
    it('becomes ready with its size, a placeholder and every width that fits, and loses its metadata', async () => {
      const { b } = await signedIn('catalog')
      const data = await jpeg(2000, 1500, true)
      expect(data.includes('secretowner')).toBe(true)
      const { id, slot } = await upload(b, data)
      const info = (await b.call('GET', `/admin/media/${id}`)).body
      expect(info).toMatchObject({ id, kind: 'image', status: 'ready', width: 2000, height: 1500, alt: '' })
      expect(info.image.srcset.split(', ').map((/** @type {string} */ s) => s.split(' ')[1])).toEqual(['320w', '480w', '640w', '828w', '1080w', '1600w'])
      expect(info.image.src).toMatch(/\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/w828\.jpg$/)
      expect(info.image.src.startsWith(config.IMG_BASE_URL)).toBe(true)
      expect(info.image.lqip).toMatch(/^data:image\/webp;base64,/)
      expect(info.image.lqip.length).toBeLessThanOrEqual(1500)
      const key = new URL(slot.uploadUrl).pathname.replace('/api/v1/_dev/uploads/', '')
      const stored = await storage.read(key)
      expect(stored.includes('secretowner')).toBe(false)
      expect(info.bytes).toBe(stored.length)
      expect((await sharp(await storage.read(key.replace(/\.jpg$/, '/w1600.webp'))).metadata()).width).toBe(1600)
      expect((await sharp(await storage.read(key.replace(/\.jpg$/, '/w320.jpg'))).metadata()).width).toBe(320)
    }, 60_000)

    it('is served as generated sizes only: the image host never gives out the original', async () => {
      const { b } = await signedIn('catalog')
      const { id, slot } = await upload(b, await jpeg(900, 600))
      const key = new URL(slot.uploadUrl).pathname.replace('/api/v1/_dev/uploads/', '')
      const size = await app.inject(`/img/${key.replace(/\.jpg$/, '/w640.webp')}`)
      expect(size.statusCode).toBe(200)
      expect(size.headers).toMatchObject({ 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', 'cross-origin-resource-policy': 'cross-origin' })
      expect((await app.inject(`/img/${key}`)).statusCode).toBe(404)
      expect((await app.inject('/img/media/2026/10/../../../etc/passwd')).statusCode).toBe(404)
      expect((await app.inject('/img/media/2026/10/0190f2c0-0000-7000-8000-0000000000ff/w640.webp')).statusCode).toBe(404)
      expect(id).toBeTruthy()
    }, 60_000)

    it('is not enlarged: a small picture gets only the smallest size; a phone photo is turned upright', async () => {
      const { b } = await signedIn('catalog')
      const small = await upload(b, await png(200, 100), { type: 'image/png' })
      const info = (await b.call('GET', `/admin/media/${small.id}`)).body
      expect(info.image.srcset.split(', ')).toHaveLength(1)
      const key = new URL(small.slot.uploadUrl).pathname.replace('/api/v1/_dev/uploads/', '')
      expect((await sharp(await storage.read(key.replace(/\.png$/, '/w320.webp'))).metadata()).width).toBe(200)

      const sideways = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#336699' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
      const turned = await upload(b, sideways)
      expect((await b.call('GET', `/admin/media/${turned.id}`)).body).toMatchObject({ width: 400, height: 600 })
    }, 60_000)
  })

  describe('files that are not what they say', () => {
    /** @param {Buffer} data @param {string} reason @param {string} [type] */
    async function refused(data, reason, type = 'image/jpeg') {
      const { b } = await signedIn('catalog')
      const { id, slot } = await upload(b, data, { type })
      const info = (await b.call('GET', `/admin/media/${id}`)).body
      expect(info).toMatchObject({ status: 'rejected', rejectReason: reason })
      expect(info.image).toBeUndefined()
      const key = new URL(slot.uploadUrl).pathname.replace('/api/v1/_dev/uploads/', '')
      expect(await storage.size(key), 'the refused file is deleted').toBeNull()
    }

    it('a renamed HTML file is rejected and deleted', () => refused(Buffer.from('<html><body><script>alert(1)</script></body></html>'), 'not_an_image'), 30_000)
    it('an SVG sent as an image is rejected', () => refused(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), 'not_an_image'), 30_000)
    it('a PNG declared as JPEG is rejected', async () => refused(await png(50, 50), 'type_mismatch'), 30_000)
    it('a picture over 8000 pixels on a side is rejected', async () => refused(await sharp({ create: { width: 8001, height: 1, channels: 3, background: '#fff' } }).png().toBuffer(), 'too_many_pixels', 'image/png'), 60_000)
    it('a truncated picture is rejected as unreadable', async () => refused((await jpeg(800, 600)).subarray(0, 300), 'unreadable'), 30_000)
  })

  describe('the upload link', () => {
    /** @param {string} uploadUrl */
    const parts = (uploadUrl) => {
      const u = new URL(uploadUrl)
      return { path: u.pathname, search: u.search }
    }

    it('accepts exactly the pinned type and size, from the admin site, before it expires', async () => {
      const { b } = await signedIn('catalog')
      const data = await jpeg(100, 100)
      const slot = (await b.call('POST', '/admin/media/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', bytes: data.length } })).body
      const { path: p, search } = parts(slot.uploadUrl)
      const put = (/** @type {Record<string, string>} */ headers, /** @type {Buffer} */ payload = data, url = p + search) => app.inject({ method: 'PUT', url, headers: { 'content-type': 'image/jpeg', origin: ORIGIN, ...headers }, payload })
      expect((await put({ 'content-type': 'image/png' })).statusCode, 'other type').toBe(403)
      expect((await put({}, Buffer.concat([data, Buffer.from('x')]))).statusCode, 'other size').toBe(403)
      expect((await put({}, data, p + search.replace(/sig=[0-9a-f]{4}/, 'sig=0000'))).statusCode, 'forged signature').toBe(403)
      const other = (await b.call('POST', '/admin/media/uploads', { body: { filename: 'b.jpg', contentType: 'image/jpeg', bytes: data.length } })).body
      expect((await put({}, data, parts(other.uploadUrl).path + search)).statusCode, 'signature of another key').toBe(403)
      expect((await put({ origin: 'http://evil.example' })).statusCode, 'other site').toBe(403)
      expect((await app.inject({ method: 'PUT', url: p + search, headers: { 'content-type': 'image/jpeg' }, payload: data })).statusCode, 'no Origin').toBe(403)
      expect((await put({})).statusCode).toBe(200)
      expect(await storage.size(p.replace('/api/v1/_dev/uploads/', ''))).toBe(data.length)
    }, 60_000)

    it('answers the browser preflight for the admin origin only, and stops working after ten minutes', async () => {
      const { b } = await signedIn('catalog')
      setClock(new Date('2026-10-04T10:00:00.000Z'))
      const data = await jpeg(60, 60)
      const slot = (await b.call('POST', '/admin/media/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', bytes: data.length } })).body
      const { path: p, search } = parts(slot.uploadUrl)
      const pre = await app.inject({ method: 'OPTIONS', url: p + search, headers: { origin: ORIGIN, 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type' } })
      expect(pre.statusCode).toBe(204)
      expect(pre.headers['access-control-allow-origin']).toBe(ORIGIN)
      expect(slot.expiresAt).toBe('2026-10-04T10:10:00.000Z')
      advanceClock(600_001)
      expect((await app.inject({ method: 'PUT', url: p + search, headers: { 'content-type': 'image/jpeg', origin: ORIGIN }, payload: data })).statusCode).toBe(403)
    }, 60_000)
  })

  describe('asking for a slot', () => {
    it('refuses types we do not take, and sizes over 10 MB or zero', async () => {
      const { b } = await signedIn('catalog')
      const ask = (/** @type {object} */ body) => b.call('POST', '/admin/media/uploads', { body })
      for (const type of ['text/html', 'image/svg+xml', 'image/gif', 'video/mp4', 'application/octet-stream']) {
        const r = await ask({ filename: 'x', contentType: type, bytes: 1000 })
        expect([r.status, r.body.issues]).toEqual([400, [{ path: 'contentType', code: 'invalid_format' }]])
      }
      expect((await ask({ filename: 'x', contentType: 'image/jpeg', bytes: 10 * 1024 * 1024 + 1 })).body.issues).toEqual([{ path: 'bytes', code: 'too_big' }])
      expect((await ask({ filename: 'x', contentType: 'image/jpeg', bytes: 0 })).body.issues).toEqual([{ path: 'bytes', code: 'too_small' }])
      expect((await ask({ filename: 'x', contentType: 'image/jpeg', bytes: 10, extra: 1 })).status).toBe(400)
    }, 60_000)

    it('names the file after our own id and the verified type, never after the file name given', async () => {
      const { b } = await signedIn('catalog')
      const slot = (await b.call('POST', '/admin/media/uploads', { body: { filename: '../../evil.php', contentType: 'image/webp', bytes: 1000 } })).body
      expect(new URL(slot.uploadUrl).pathname).toMatch(/\/_dev\/uploads\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/)
      expect(slot.headers).toEqual({ 'content-type': 'image/webp' })
      const [row] = await t.db.select().from(media)
      expect(row).toMatchObject({ status: 'pending', contentType: 'image/webp', bytes: 1000, confirmedAt: null })
    }, 60_000)
  })

  describe('confirming', () => {
    it('needs the file to be there, and queues the check once however often it is called', async () => {
      const { b } = await signedIn('catalog')
      const data = await jpeg(100, 100)
      const slot = (await b.call('POST', '/admin/media/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', bytes: data.length } })).body
      const early = await b.call('POST', `/admin/media/${slot.mediaId}/confirm`)
      expect([early.status, early.body.issues]).toEqual([400, [{ path: 'upload', code: 'required' }]])
      expect(await t.db.select().from(jobs)).toHaveLength(0)
      const url = new URL(slot.uploadUrl)
      await app.inject({ method: 'PUT', url: url.pathname + url.search, headers: { ...slot.headers, origin: ORIGIN }, payload: data })
      for (let i = 0; i < 3; i++) expect((await b.call('POST', `/admin/media/${slot.mediaId}/confirm`)).body.status).toBe('pending')
      const queued = await t.db.select().from(jobs)
      expect(queued).toHaveLength(1)
      expect(queued[0]).toMatchObject({ type: 'media.process', payload: { mediaId: slot.mediaId } })
    }, 60_000)

    it('processing the same media twice changes nothing the second time', async () => {
      const { b } = await signedIn('catalog')
      const { id } = await upload(b, await jpeg(300, 300))
      const [first] = await t.db.select().from(media)
      await service.process(id)
      expect((await t.db.select().from(media))[0]).toEqual(first)
    }, 60_000)

    it('unknown ids are 404', async () => {
      const { b } = await signedIn('catalog')
      const ghost = '0190f2c0-0000-7000-8000-0000000000ff'
      expect((await b.call('POST', `/admin/media/${ghost}/confirm`)).status).toBe(404)
      expect((await b.call('GET', `/admin/media/${ghost}`)).status).toBe(404)
      expect((await b.call('PUT', `/admin/media/${ghost}`, { body: { alt: 'x' } })).status).toBe(404)
      expect((await b.call('DELETE', `/admin/media/${ghost}`)).status).toBe(404)
    }, 60_000)
  })

  describe('alt text and deleting', () => {
    it('saves the default alt text and the Urdu one, and writes the change to the audit trail', async () => {
      const { b } = await signedIn('catalog')
      const { id } = await upload(b, await jpeg(300, 300))
      const r = await b.call('PUT', `/admin/media/${id}`, { body: { alt: 'Green lawn suit', i18n: { ur: { alt: 'ہرا سوٹ' } } } })
      expect(r.body).toMatchObject({ alt: 'Green lawn suit', i18n: { ur: { alt: 'ہرا سوٹ' } }, image: { alt: 'Green lawn suit' } })
      const entry = (await t.db.select().from(auditLog)).find((e) => e.action === 'media.updated')
      expect(entry).toMatchObject({ action: 'media.updated', entityType: 'media', entityId: id, actorRole: 'catalog' })
      expect(entry?.diff).toEqual({ alt: ['', 'Green lawn suit'], 'i18n.ur.alt': ['', 'ہرا سوٹ'] })
      expect((await b.call('PUT', `/admin/media/${id}`, { body: { alt: 'Green lawn suit', unknown: 1 } })).status).toBe(400)
      expect((await b.call('PUT', `/admin/media/${id}`, { body: { alt: 'x'.repeat(301) } })).status).toBe(400)
      expect((await b.call('PUT', `/admin/media/${id}`, { body: { alt: 'Plain' } })).body.i18n).toBeUndefined()
    }, 60_000)

    it('deleting removes the row now and the files by a job, and is audited', async () => {
      const { b } = await signedIn('catalog')
      const { id, slot } = await upload(b, await jpeg(900, 600))
      const key = new URL(slot.uploadUrl).pathname.replace('/api/v1/_dev/uploads/', '')
      await t.db.delete(jobs)
      expect((await b.call('DELETE', `/admin/media/${id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/media/${id}`)).status).toBe(404)
      expect(await storage.size(key), 'bytes wait for the job').not.toBeNull()
      const [job] = await t.db.select().from(jobs)
      expect(job).toMatchObject({ type: 'media.purge', payload: { objectKey: key } })
      await mediaJobs(service)['media.purge']?.({ job: { id: 'j', type: 'media.purge', payload: job?.payload, attempts: 0, maxAttempts: 8 }, signal: new AbortController().signal })
      expect(await storage.size(key)).toBeNull()
      expect(existsSync(path.join(storageDir, ...key.replace(/\.jpg$/, '').split('/')))).toBe(false)
      expect((await t.db.select().from(auditLog)).map((e) => e.action)).toContain('media.deleted')
    }, 60_000)

    it('a file that something refers to cannot be deleted (in_use)', async () => {
      const { b } = await signedIn('catalog')
      const { id } = await upload(b, await jpeg(300, 300))
      await t.migrate.pool.query('CREATE TABLE test_uses_media (media_id char(36) character set ascii collate ascii_bin NOT NULL, FOREIGN KEY (media_id) REFERENCES media(id))')
      try {
        await t.migrate.pool.query('INSERT INTO test_uses_media VALUES (?)', [id])
        const r = await b.call('DELETE', `/admin/media/${id}`)
        expect([r.status, r.body.code]).toEqual([409, 'in_use'])
        expect((await b.call('GET', `/admin/media/${id}`)).body.status).toBe('ready')
        expect((await t.db.select().from(jobs)).filter((j) => j.type === 'media.purge')).toHaveLength(0)
      } finally {
        await t.migrate.pool.query('DROP TABLE test_uses_media')
      }
    }, 60_000)
  })

  describe('cleanup', () => {
    it('removes slots never confirmed within a day and refused files after a day; keeps the rest', async () => {
      const { b } = await signedIn('catalog')
      setClock(new Date('2026-10-04T10:00:00.000Z'))
      const stale = await upload(b, await jpeg(100, 100), { process: false }) // confirmed, waiting for the worker
      const unconfirmed = (await b.call('POST', '/admin/media/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', bytes: 5 } })).body
      const refused = await upload(b, Buffer.from('<html></html>'))
      const good = await upload(b, await jpeg(100, 100))
      advanceClock(23 * 3_600_000)
      await service.cleanup()
      expect((await t.db.select().from(media)).length, 'nothing is a day old yet').toBe(4)
      advanceClock(2 * 3_600_000)
      await service.cleanup()
      const left = (await t.db.select().from(media)).map((m) => m.id).sort()
      expect(left).toEqual([stale.id, good.id].sort())
      expect(unconfirmed.mediaId).toBeTruthy()
      expect(refused.id).toBeTruthy()
    }, 60_000)
  })

})
