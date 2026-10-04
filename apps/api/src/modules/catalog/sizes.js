// Size systems (the ordered size labels), size charts (measurement tables) and custom-size forms (DOC-07.4 section 5).
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { readyIds } from '../media/repository.js'
import { diffOf, record } from '../audit/index.js'
import { actorOf, duplicateKey, isReferenced, purge } from './common.js'
import * as repo from './repository.js'

/** @typedef {import('./common.js').Staff} Staff */
/** @typedef {import('./common.js').RequestInfo} RequestInfo */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').SizeSystemInput>} SizeSystemInput */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').SizeChartInput>} SizeChartInput */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').FormSchemaInput>} FormSchemaInput */

const issue = (/** @type {string} */ path, /** @type {import('@noor/contract').FieldIssueCode} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('./common.js').Usage} deps.usage
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 */
export function createSizes({ db, usage, media }) {
  // ================================ size systems ================================
  /** @param {import('../../platform/db.js').Executor} x @param {string} [onlyId] */
  async function systemViews(x, onlyId) {
    const systems = onlyId ? [await repo.findSizeSystem(x, onlyId)].filter((s) => !!s) : await repo.allSizeSystems(x)
    const values = await repo.sizeValuesOf(x, systems.map((s) => /** @type {{ id: string }} */ (s).id))
    return Promise.all(
      systems.map(async (s) => ({
        id: /** @type {{ id: string }} */ (s).id,
        name: /** @type {{ name: string }} */ (s).name,
        values: await Promise.all(values.filter((v) => v.sizeSystemId === /** @type {{ id: string }} */ (s).id).map(async (v) => ({ id: v.id, label: v.label, usedByVariants: await usage.sizeValueVariants(v.id) }))),
      })),
    )
  }

  /** @param {string} id */
  async function systemView(id) {
    const v = (await systemViews(db, id))[0]
    if (!v) throw new DomainError('not_found')
    return v
  }

  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  const systemSnapshot = async (x, id) => ({ name: (await repo.findSizeSystem(x, id))?.name, sizes: (await repo.sizeValuesOf(x, [id])).map((v) => v.label) })

  /** @param {SizeSystemInput} input */
  function checkLabels(input) {
    const seen = new Set()
    for (const [i, v] of input.values.entries()) {
      const key = v.label.toLowerCase()
      if (seen.has(key)) throw issue(`values.${i}.label`, 'not_unique')
      seen.add(key)
    }
  }

  // ================================ size charts ================================
  /** @param {repo.ChartRow} c */
  async function toChart(c, images = /** @type {Record<string, import('@noor/contract').Image>} */ ({})) {
    const ur = /** @type {{ ur?: Record<string, string | undefined> } | null} */ (c.i18n)?.ur
    return {
      id: c.id,
      title: c.title,
      sizeSystemId: c.sizeSystemId,
      unit: /** @type {'in' | 'cm'} */ (c.unit),
      ...(c.notes ? { notes: c.notes } : {}),
      guideMediaId: c.guideMediaId,
      tables: /** @type {SizeChartInput['tables']} */ (c.tables),
      ...(ur ? { i18n: { ur } } : {}),
      version: c.version,
      usedBy: await usage.sizeChartProducts(c.id),
      ...(c.guideMediaId && images[c.guideMediaId] ? { guideImage: images[c.guideMediaId] } : {}),
      updatedAt: c.updatedAt.toISOString(),
    }
  }

  /** @param {string} id */
  async function chartView(id) {
    const c = await repo.findChart(db, id)
    if (!c) throw new DomainError('not_found')
    return toChart(c, await media.imagesFor(c.guideMediaId ? [c.guideMediaId] : []))
  }

  /** @param {import('../../platform/db.js').Executor} x @param {SizeChartInput} input */
  async function checkChart(x, input) {
    /** @type {{ path: string, code: 'not_unique' | 'invalid_format' }[]} */
    const issues = []
    const ids = new Set()
    input.tables.forEach((t, ti) => {
      if (ids.has(t.id)) issues.push({ path: `tables.${ti}.id`, code: 'not_unique' })
      ids.add(t.id)
      t.rows.forEach((r, ri) => {
        if (r.values.length !== t.columns.length) issues.push({ path: `tables.${ti}.rows.${ri}.values`, code: 'invalid_format' })
      })
    })
    if (issues.length) throw new DomainError('validation_failed', { issues })
    if (input.sizeSystemId && !(await repo.findSizeSystem(x, input.sizeSystemId))) throw issue('sizeSystemId', 'invalid_format')
    if (input.guideMediaId && !(await readyIds(x, [input.guideMediaId])).has(input.guideMediaId)) throw new DomainError('media_not_ready', { mediaId: input.guideMediaId })
  }

  /** @param {SizeChartInput} input */
  const chartColumns = (input) => ({
    title: input.title,
    sizeSystemId: input.sizeSystemId ?? null,
    unit: input.unit,
    tables: input.tables,
    guideMediaId: input.guideMediaId ?? null,
    notes: input.notes || null,
    i18n: input.i18n?.ur ? { ur: input.i18n.ur } : null,
  })

  // ================================ forms ================================
  /** @param {repo.FormRow} f */
  async function toForm(f) {
    return {
      id: f.id,
      title: f.title,
      fields: /** @type {FormSchemaInput['fields']} */ (f.fields),
      allowNotes: f.allowNotes,
      version: f.version,
      usedBy: await usage.formSchemaProducts(f.id),
      updatedAt: f.updatedAt.toISOString(),
    }
  }

  /** @param {string} id */
  async function formView(id) {
    const f = await repo.findForm(db, id)
    if (!f) throw new DomainError('not_found')
    return toForm(f)
  }

  /** @param {FormSchemaInput} input */
  function checkForm(input) {
    /** @type {{ path: string, code: 'not_unique' | 'required' | 'too_big' }[]} */
    const issues = []
    const keys = new Set()
    input.fields.forEach((f, i) => {
      if (keys.has(f.key)) issues.push({ path: `fields.${i}.key`, code: 'not_unique' })
      keys.add(f.key)
      if (f.type === 'select' && !f.options?.length) issues.push({ path: `fields.${i}.options`, code: 'required' })
      if (f.min !== undefined && f.max !== undefined && f.min > f.max) issues.push({ path: `fields.${i}.min`, code: 'too_big' })
    })
    if (issues.length) throw new DomainError('validation_failed', { issues })
  }

  return {
    // ---- systems ----
    list: async () => ({ items: await systemViews(db) }),

    /** @param {Staff} actor @param {SizeSystemInput} input @param {RequestInfo} req */
    async createSystem(actor, input, req) {
      checkLabels(input)
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          const at = now()
          await repo.insertSizeSystem(tx, { id, name: input.name, createdAt: at, updatedAt: at })
          for (const [i, v] of input.values.entries()) await repo.insertSizeValue(tx, { id: uuidv7(), sizeSystemId: id, label: v.label, sortOrder: i })
          await record(tx, { ...actorOf(actor, req), action: 'size_system.created', entityType: 'size_system', entityId: id, entityLabel: input.name, diff: diffOf({}, await systemSnapshot(tx, id)) })
          await purge(tx, ['sizes'], req.requestId)
        })
      } catch (e) {
        if (duplicateKey(e) === 'size_systems_name_uq') throw issue('name', 'not_unique')
        throw e
      }
      return systemView(id)
    },

    /** @param {Staff} actor @param {string} id @param {SizeSystemInput} input @param {RequestInfo} req */
    async updateSystem(actor, id, input, req) {
      checkLabels(input)
      try {
        await transaction(db, async (tx) => {
          const s = await repo.lockSizeSystem(tx, id)
          if (!s) throw new DomainError('not_found')
          const before = await systemSnapshot(tx, id)
          const existing = await repo.sizeValuesOf(tx, [id])
          const byId = new Map(existing.map((v) => [v.id, v]))
          const unknown = input.values.findIndex((v) => v.id && !byId.has(v.id))
          if (unknown >= 0) throw issue(`values.${unknown}.id`, 'invalid_format')
          const kept = new Set(input.values.flatMap((v) => (v.id ? [v.id] : [])))
          const removed = existing.filter((v) => !kept.has(v.id))
          const blocked = []
          for (const v of removed) {
            const n = await usage.sizeValueVariants(v.id)
            if (n) blocked.push({ id: v.id, label: v.label, usedByVariants: n })
          }
          if (blocked.length) throw new DomainError('in_use', { values: blocked })
          await repo.deleteSizeValues(tx, removed.map((v) => v.id))
          // labels may swap places (S<->M), so park the changed ones under a name nobody has before writing the final labels
          const changed = input.values.filter((v) => v.id && byId.get(v.id)?.label !== v.label)
          for (const v of changed) await repo.updateSizeValue(tx, /** @type {string} */ (v.id), { label: `~${/** @type {string} */ (v.id).slice(-9)}` })
          for (const [i, v] of input.values.entries()) {
            if (v.id) await repo.updateSizeValue(tx, v.id, { label: v.label, sortOrder: i })
            else await repo.insertSizeValue(tx, { id: uuidv7(), sizeSystemId: id, label: v.label, sortOrder: i })
          }
          await repo.updateSizeSystem(tx, id, { name: input.name, updatedAt: now() })
          await record(tx, { ...actorOf(actor, req), action: 'size_system.updated', entityType: 'size_system', entityId: id, entityLabel: input.name, diff: diffOf(before, await systemSnapshot(tx, id)) })
          await purge(tx, ['sizes'], req.requestId)
        })
      } catch (e) {
        if (duplicateKey(e) === 'size_systems_name_uq') throw issue('name', 'not_unique')
        throw e
      }
      return systemView(id)
    },

    /** @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async removeSystem(actor, id, req) {
      try {
        await transaction(db, async (tx) => {
          const s = await repo.lockSizeSystem(tx, id)
          if (!s) throw new DomainError('not_found')
          const options = await usage.sizeSystemOptions(id)
          if (options) throw new DomainError('in_use', { usedBy: { options } })
          const before = await systemSnapshot(tx, id)
          await repo.deleteSizeSystem(tx, id)
          await record(tx, { ...actorOf(actor, req), action: 'size_system.deleted', entityType: 'size_system', entityId: id, entityLabel: s.name, diff: diffOf(before, {}) })
          await purge(tx, ['sizes'], req.requestId)
        })
      } catch (e) {
        if (isReferenced(e)) throw new DomainError('in_use')
        throw e
      }
    },

    // ---- charts ----
    async listCharts() {
      const charts = await repo.allCharts(db)
      const images = await media.imagesFor(charts.flatMap((c) => (c.guideMediaId ? [c.guideMediaId] : [])))
      return { items: await Promise.all(charts.map((c) => toChart(c, images))) }
    },
    getChart: chartView,

    /** @param {Staff} actor @param {SizeChartInput} input @param {RequestInfo} req */
    async createChart(actor, input, req) {
      const id = uuidv7()
      await transaction(db, async (tx) => {
        await checkChart(tx, input)
        const at = now()
        await repo.insertChart(tx, { id, ...chartColumns(input), version: 1, createdAt: at, updatedAt: at })
        await record(tx, { ...actorOf(actor, req), action: 'size_chart.created', entityType: 'size_chart', entityId: id, entityLabel: input.title, diff: diffOf({}, { title: input.title, unit: input.unit, tables: input.tables.map((t) => t.title) }) })
        await purge(tx, ['sizes'], req.requestId)
      })
      return chartView(id)
    },

    /** @param {Staff} actor @param {string} id @param {SizeChartInput & { version: number }} input @param {RequestInfo} req */
    async updateChart(actor, id, input, req) {
      await transaction(db, async (tx) => {
        const c = await repo.lockChart(tx, id)
        if (!c) throw new DomainError('not_found')
        if (c.version !== input.version) throw new DomainError('stale_write', { currentVersion: c.version })
        await checkChart(tx, input)
        await repo.updateChart(tx, id, { ...chartColumns(input), version: c.version + 1, updatedAt: now() })
        const snap = (/** @type {{ title: string, unit: string, sizeSystemId?: string | null, notes?: string | null, tables: unknown }} */ x) => ({ title: x.title, unit: x.unit, sizeSystemId: x.sizeSystemId ?? null, notes: x.notes ?? null, tables: x.tables })
        await record(tx, { ...actorOf(actor, req), action: 'size_chart.updated', entityType: 'size_chart', entityId: id, entityLabel: input.title, diff: diffOf(snap(c), snap(input)) })
        await purge(tx, ['sizes'], req.requestId)
      })
      return chartView(id)
    },

    /** Products using the chart simply lose the link. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async removeChart(actor, id, req) {
      await transaction(db, async (tx) => {
        const c = await repo.lockChart(tx, id)
        if (!c) throw new DomainError('not_found')
        await repo.deleteChart(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'size_chart.deleted', entityType: 'size_chart', entityId: id, entityLabel: c.title, diff: { title: [c.title, null] } })
        await purge(tx, ['sizes'], req.requestId)
      })
    },

    // ---- forms ----
    async listForms() {
      return { items: await Promise.all((await repo.allForms(db)).map(toForm)) }
    },
    getForm: formView,

    /** @param {Staff} actor @param {FormSchemaInput} input @param {RequestInfo} req */
    async createForm(actor, input, req) {
      checkForm(input)
      const id = uuidv7()
      await transaction(db, async (tx) => {
        const at = now()
        await repo.insertForm(tx, { id, title: input.title, fields: input.fields, allowNotes: input.allowNotes, version: 1, createdAt: at, updatedAt: at })
        await record(tx, { ...actorOf(actor, req), action: 'form_schema.created', entityType: 'form_schema', entityId: id, entityLabel: input.title, diff: diffOf({}, { title: input.title, fields: input.fields.map((f) => f.key) }) })
        await purge(tx, ['sizes'], req.requestId)
      })
      return formView(id)
    },

    /**
     * A form some product uses may gain fields, never lose or rename one: products keep customers' answers by key.
     * @param {Staff} actor @param {string} id @param {FormSchemaInput & { version: number }} input @param {RequestInfo} req
     */
    async updateForm(actor, id, input, req) {
      checkForm(input)
      await transaction(db, async (tx) => {
        const f = await repo.lockForm(tx, id)
        if (!f) throw new DomainError('not_found')
        if (f.version !== input.version) throw new DomainError('stale_write', { currentVersion: f.version })
        const old = /** @type {FormSchemaInput['fields']} */ (f.fields)
        if (await usage.formSchemaProducts(id)) {
          const now_ = new Set(input.fields.map((x) => x.key))
          const lost = old.findIndex((x) => !now_.has(x.key))
          if (lost >= 0) throw issue(`fields.${Math.min(lost, input.fields.length - 1)}.key`, 'invalid_format')
        }
        await repo.updateForm(tx, id, { title: input.title, fields: input.fields, allowNotes: input.allowNotes, version: f.version + 1, updatedAt: now() })
        await record(tx, { ...actorOf(actor, req), action: 'form_schema.updated', entityType: 'form_schema', entityId: id, entityLabel: input.title, diff: diffOf({ title: f.title, allowNotes: f.allowNotes, fields: old }, { title: input.title, allowNotes: input.allowNotes, fields: input.fields }) })
        await purge(tx, ['sizes'], req.requestId)
      })
      return formView(id)
    },

    /** @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async removeForm(actor, id, req) {
      try {
        await transaction(db, async (tx) => {
          const f = await repo.lockForm(tx, id)
          if (!f) throw new DomainError('not_found')
          const products = await usage.formSchemaProducts(id)
          if (products) throw new DomainError('in_use', { usedBy: { products } })
          await repo.deleteForm(tx, id)
          await record(tx, { ...actorOf(actor, req), action: 'form_schema.deleted', entityType: 'form_schema', entityId: id, entityLabel: f.title, diff: { title: [f.title, null] } })
          await purge(tx, ['sizes'], req.requestId)
        })
      } catch (e) {
        if (isReferenced(e)) throw new DomainError('in_use')
        throw e
      }
    },
  }
}
