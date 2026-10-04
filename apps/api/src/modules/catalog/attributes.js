// Attributes (fabric, occasion, pieces ...) and their values: what products are described by and what the storefront filters on
// (DOC-07.4 section 4). The code and the type never change after creation; a value's id and code never change either.
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { diffOf, record } from '../audit/index.js'
import { actorOf, duplicateKey, isReferenced, purge } from './common.js'
import * as repo from './repository.js'

/** @typedef {import('./common.js').Staff} Staff */
/** @typedef {import('./common.js').RequestInfo} RequestInfo */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AttributeInput>} AttributeInput */

/** A yes/no attribute has exactly these two values, and a number attribute one placeholder that carries the figure in `value_number`. */
const FIXED = /** @type {const} */ ({
  boolean: [{ code: 'yes', label: 'Yes' }, { code: 'no', label: 'No' }],
  number: [{ code: 'value', label: 'Value' }],
})

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('./common.js').Usage} deps.usage
 */
export function createAttributes({ db, usage }) {
  /** @param {repo.ValueRow[]} values */
  const toValues = async (values) =>
    Promise.all(
      values.map(async (v) => {
        const ur = /** @type {{ ur?: { label?: string } } | null} */ (v.i18n)?.ur
        return {
          id: v.id,
          code: v.code,
          label: v.label,
          ...(v.swatch ? { swatch: /** @type {import('@noor/contract').Swatch} */ (v.swatch) } : {}),
          ...(ur?.label ? { i18n: { ur } } : {}),
          usedByProducts: await usage.valueProducts(v.id),
        }
      }),
    )

  /** @param {import('../../platform/db.js').Executor} x @param {string} [onlyId] */
  async function listAll(x, onlyId) {
    const attrs = onlyId ? (await repo.attributesByIds(x, [onlyId])) : await repo.allAttributes(x)
    const values = await repo.valuesOf(x, attrs.map((a) => a.id))
    return Promise.all(
      attrs.map(async (a) => {
        const ur = /** @type {{ ur?: { label?: string } } | null} */ (a.i18n)?.ur
        return {
          id: a.id,
          code: a.code,
          label: a.label,
          type: /** @type {import('@noor/contract').EnumValue<'attributeType'>} */ (a.type),
          display: /** @type {import('@noor/contract').EnumValue<'attributeDisplay'>} */ (a.display),
          filterable: a.filterable,
          ...(a.groupLabel ? { group: a.groupLabel } : {}),
          values: await toValues(values.filter((v) => v.attributeId === a.id)),
          ...(ur?.label ? { i18n: { ur } } : {}),
          usedByProducts: await usage.attributeProducts(a.id),
          usedByCategories: await repo.categoriesUsing(x, a.id),
        }
      }),
    )
  }

  /** @param {string} id */
  async function view(id) {
    const v = (await listAll(db, id))[0]
    if (!v) throw new DomainError('not_found')
    return v
  }

  /** @param {AttributeInput} input */
  function checkValues(input) {
    /** @type {{ path: string, code: 'not_unique' | 'invalid_format' | 'required' }[]} */
    const issues = []
    if (input.type === 'boolean' || input.type === 'number') {
      if (input.values.length) issues.push({ path: 'values', code: 'invalid_format' }) // the server owns these values
    } else if (!input.values.length) issues.push({ path: 'values', code: 'required' })
    const codes = new Set()
    input.values.forEach((v, i) => {
      if (codes.has(v.code)) issues.push({ path: `values.${i}.code`, code: 'not_unique' })
      codes.add(v.code)
      if (input.type !== 'color' && v.swatch) issues.push({ path: `values.${i}.swatch`, code: 'invalid_format' })
    })
    if (input.type === 'color' && input.values.some((v) => !v.swatch)) issues.push({ path: 'values', code: 'required' })
    if (issues.length) throw new DomainError('validation_failed', { issues })
  }

  /** @param {AttributeInput} input */
  const attributeColumns = (input) => ({
    label: input.label,
    display: input.display,
    filterable: input.filterable,
    groupLabel: input.group || null,
    i18n: input.i18n?.ur?.label ? { ur: { label: input.i18n.ur.label } } : null,
    updatedAt: now(),
  })

  /** @param {AttributeInput['values'][number]} v @param {number} i */
  const valueColumns = (v, i) => ({ label: v.label, swatch: v.swatch ?? null, sortOrder: i, i18n: v.i18n?.ur?.label ? { ur: { label: v.i18n.ur.label } } : null })

  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  async function snapshot(x, id) {
    const a = /** @type {repo.AttributeRow} */ (await repo.findAttribute(x, id))
    const values = await repo.valuesOf(x, [id])
    return { code: a.code, label: a.label, type: a.type, display: a.display, filterable: a.filterable, group: a.groupLabel, values: values.map((v) => `${v.code}:${v.label}`) }
  }

  return {
    list: async () => ({ items: await listAll(db) }),

    /** @param {Staff} actor @param {AttributeInput} input @param {RequestInfo} req */
    async create(actor, input, req) {
      checkValues(input)
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          const at = now()
          await repo.insertAttribute(tx, { id, code: input.code, type: input.type, ...attributeColumns(input), sortOrder: (await repo.allAttributes(tx)).length, createdAt: at })
          const fixed = input.type === 'boolean' || input.type === 'number' ? FIXED[input.type] : []
          const values = fixed.length ? fixed : input.values
          for (const [i, v] of values.entries()) {
            await repo.insertValue(tx, { id: uuidv7(), attributeId: id, code: v.code, ...valueColumns(/** @type {AttributeInput['values'][number]} */ (v), i) })
          }
          await record(tx, { ...actorOf(actor, req), action: 'attribute.created', entityType: 'attribute', entityId: id, entityLabel: input.code, diff: diffOf({}, await snapshot(tx, id)) })
          await purge(tx, ['attributes', 'categories'], req.requestId)
        })
      } catch (e) {
        const key = duplicateKey(e)
        if (key === 'attributes_code_uq') throw new DomainError('code_taken')
        if (key === 'attribute_values_code_uq') throw new DomainError('validation_failed', { issues: [{ path: 'values', code: 'not_unique' }] })
        throw e
      }
      return view(id)
    },

    /** @param {Staff} actor @param {string} id @param {AttributeInput} input @param {RequestInfo} req */
    async update(actor, id, input, req) {
      checkValues(input)
      await transaction(db, async (tx) => {
        const a = await repo.lockAttribute(tx, id)
        if (!a) throw new DomainError('not_found')
        if (input.code !== a.code) throw new DomainError('validation_failed', { issues: [{ path: 'code', code: 'invalid_format' }] })
        if (input.type !== a.type) throw new DomainError('validation_failed', { issues: [{ path: 'type', code: 'invalid_format' }] })
        const before = await snapshot(tx, id)
        await repo.updateAttribute(tx, id, attributeColumns(input))
        if (input.type === 'enum' || input.type === 'color') {
          const existing = await repo.valuesOf(tx, [id])
          const byId = new Map(existing.map((v) => [v.id, v]))
          /** @type {{ path: string, code: 'invalid_format' }[]} */
          const issues = []
          input.values.forEach((v, i) => {
            if (v.id && !byId.has(v.id)) issues.push({ path: `values.${i}.id`, code: 'invalid_format' })
            else if (v.id && byId.get(v.id)?.code !== v.code) issues.push({ path: `values.${i}.code`, code: 'invalid_format' }) // a value's code is its URL form
          })
          if (issues.length) throw new DomainError('validation_failed', { issues })
          const kept = new Set(input.values.flatMap((v) => (v.id ? [v.id] : [])))
          const removed = existing.filter((v) => !kept.has(v.id))
          const blocked = []
          for (const v of removed) {
            const n = await usage.valueProducts(v.id)
            if (n) blocked.push({ id: v.id, code: v.code, usedByProducts: n })
          }
          if (blocked.length) throw new DomainError('in_use', { values: blocked })
          await repo.deleteValues(tx, removed.map((v) => v.id))
          for (const [i, v] of input.values.entries()) {
            if (v.id) await repo.updateValue(tx, v.id, valueColumns(v, i))
            else await repo.insertValue(tx, { id: uuidv7(), attributeId: id, code: v.code, ...valueColumns(v, i) })
          }
        }
        await record(tx, { ...actorOf(actor, req), action: 'attribute.updated', entityType: 'attribute', entityId: id, entityLabel: a.code, diff: diffOf(before, await snapshot(tx, id)) })
        await purge(tx, ['attributes', 'categories'], req.requestId)
      }).catch((e) => {
        if (duplicateKey(e) === 'attribute_values_code_uq') throw new DomainError('validation_failed', { issues: [{ path: 'values', code: 'not_unique' }] })
        if (isReferenced(e)) throw new DomainError('in_use')
        throw e
      })
      return view(id)
    },

    /** Moves everything tagged with one value to another and removes the first. @param {Staff} actor @param {string} id @param {string} valueId @param {string} intoValueId @param {RequestInfo} req */
    async mergeValue(actor, id, valueId, intoValueId, req) {
      await transaction(db, async (tx) => {
        const a = await repo.lockAttribute(tx, id)
        if (!a) throw new DomainError('not_found')
        const [from, into] = await Promise.all([repo.findValue(tx, valueId), repo.findValue(tx, intoValueId)])
        if (!from || from.attributeId !== id || !into || into.attributeId !== id) throw new DomainError('not_found')
        if (from.id === into.id) throw new DomainError('validation_failed', { issues: [{ path: 'intoValueId', code: 'invalid_format' }] })
        if (a.type !== 'enum' && a.type !== 'color') throw new DomainError('validation_failed', { issues: [{ path: 'valueId', code: 'invalid_format' }] })
        await usage.moveValue(tx, from.id, into.id)
        await repo.deleteValues(tx, [from.id])
        await record(tx, { ...actorOf(actor, req), action: 'attribute.value_merged', entityType: 'attribute', entityId: id, entityLabel: a.code, diff: { value: [from.code, into.code] } })
        await purge(tx, ['attributes', 'categories'], req.requestId)
      })
    },

    /** Blocked while any product uses it or any category lists it as a filter. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async remove(actor, id, req) {
      try {
        await transaction(db, async (tx) => {
          const a = await repo.lockAttribute(tx, id)
          if (!a) throw new DomainError('not_found')
          const [products, categories] = [await usage.attributeProducts(id), await repo.categoriesUsing(tx, id)]
          if (products || categories) throw new DomainError('in_use', { usedBy: { products, categories } })
          const before = await snapshot(tx, id)
          await repo.deleteAttribute(tx, id)
          await record(tx, { ...actorOf(actor, req), action: 'attribute.deleted', entityType: 'attribute', entityId: id, entityLabel: a.code, diff: diffOf(before, {}) })
          await purge(tx, ['attributes', 'categories'], req.requestId)
        })
      } catch (e) {
        if (isReferenced(e)) throw new DomainError('in_use')
        throw e
      }
    },
  }
}
