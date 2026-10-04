// Mass assignment (plan/11-security-auth.md section 5.5, ADR-0020): a request body may not carry fields the route does not declare,
// at any depth, so `total` in an order body is a 400 and never a silently ignored field.
import { describe, expect, it } from 'vitest'
import { routes as table, z } from '../src/index.js'

const routes = /** @type {Record<string, import('../src/index.js').RouteDef>} */ (table)

/** @param {unknown} node @param {string} where @param {string[]} open */
function findOpenObjects(node, where, open) {
  if (Array.isArray(node)) node.forEach((n, i) => findOpenObjects(n, `${where}[${i}]`, open))
  else if (node && typeof node === 'object') {
    const o = /** @type {Record<string, unknown>} */ (node)
    if (o.type === 'object' && o.properties && o.additionalProperties !== false) open.push(where)
    for (const [k, v] of Object.entries(o)) findOpenObjects(v, `${where}.${k}`, open)
  }
}

describe('request bodies are strict', () => {
  const withBody = Object.entries(routes).filter(([, r]) => r.body)

  it('there are bodies to check', () => expect(withBody.length).toBeGreaterThan(5))

  it.each(withBody)('%s rejects unknown fields at every level', (key, route) => {
    const schema = z.toJSONSchema(/** @type {z.ZodType} */ (route.body), { io: 'input', unrepresentable: 'any' })
    const open = /** @type {string[]} */ ([])
    findOpenObjects(schema, 'body', open)
    expect(open, `${key}: object schemas that accept unknown keys (use z.strictObject)`).toEqual([])
  })
})
