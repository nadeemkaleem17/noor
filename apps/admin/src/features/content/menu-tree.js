// The menu tree and its edits (plan/07-admin/09-content.md section 4). Pure functions on `[{ key, label, href, children }]`; a position is `[i]` or `[i, j]`.
import { menuLimits } from '@noor/contract'

/** @typedef {{ key: string; id?: string; label: string; href: string; targetLive?: boolean; children: MenuNode[]; }} MenuNode */

export const newKey = () => `m${Math.random().toString(36).slice(2, 10)}`

/** From what the API returns. @param {{ id: string; label: string; href: string; targetLive: boolean; children?: any[]; }[]} items @returns {MenuNode[]} */
export const fromApi = (items) => items.map((i) => ({ key: i.id, id: i.id, label: i.label, href: i.href, targetLive: i.targetLive, children: fromApi(i.children ?? []) }))

/** To what the API takes: ids of stored items kept, empty child lists left out. @param {MenuNode[]} nodes @returns {any[]} */
export const toApi = (nodes) => nodes.map((n) => ({ ...(n.id ? { id: n.id } : {}), label: n.label.trim(), href: n.href.trim(), ...(n.children.length ? { children: toApi(n.children) } : {}) }))

/** Replaces the list at a path's parent. @param {MenuNode[]} nodes @param {number[]} at @param {(list: MenuNode[]) => MenuNode[]} change */
function withList(nodes, at, change) {
  if (at.length === 1) return change(nodes)
  return nodes.map((n, i) => (i === at[0] ? { ...n, children: change(n.children) } : n))
}

/** Moves an item up (-1) or down (+1) among its siblings. @param {MenuNode[]} nodes @param {number[]} at @param {-1 | 1} delta */
export function move(nodes, at, delta) {
  const index = /** @type {number} */ (at.at(-1))
  return withList(nodes, at, (list) => {
    const to = index + delta
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, /** @type {MenuNode} */ (item))
    return next
  })
}

/** Makes a top-level item a child of the item above it. Only where the menu has a second level, and room under that item. @param {'main' | 'footer'} handle @param {MenuNode[]} nodes @param {number} i */
export function indent(handle, nodes, i) {
  const above = nodes[i - 1]
  if (menuLimits[handle].levels < 2 || !above || nodes[i]?.children.length || above.children.length >= menuLimits[handle].children) return nodes
  const item = /** @type {MenuNode} */ (nodes[i])
  return nodes.flatMap((n, k) => (k === i ? [] : k === i - 1 ? [{ ...n, children: [...n.children, item] }] : [n]))
}

/** Moves a child out to the top level, right after its parent. @param {'main' | 'footer'} handle @param {MenuNode[]} nodes @param {number} i @param {number} j */
export function outdent(handle, nodes, i, j) {
  const parent = nodes[i]
  const child = parent?.children[j]
  if (!parent || !child || nodes.length >= menuLimits[handle].top) return nodes
  return nodes.flatMap((n, k) => (k === i ? [{ ...n, children: n.children.filter((_, x) => x !== j) }, child] : [n]))
}

/** @param {MenuNode[]} nodes @param {number[]} at */
export const remove = (nodes, at) => withList(nodes, at, (list) => list.filter((_, k) => k !== at.at(-1)))

/** Edits one item. @param {MenuNode[]} nodes @param {number[]} at @param {Partial<MenuNode>} patch */
export const edit = (nodes, at, patch) => withList(nodes, at, (list) => list.map((n, k) => (k === at.at(-1) ? { ...n, ...patch } : n)))

/** Adds an empty item at the end of the top level, or of an item's children. @param {MenuNode[]} nodes @param {number} [parent] */
export function add(nodes, parent) {
  const fresh = { key: newKey(), label: '', href: '', children: [] }
  if (parent === undefined) return [...nodes, fresh]
  return nodes.map((n, i) => (i === parent ? { ...n, children: [...n.children, fresh] } : n))
}

/** Whether another item fits at a level. @param {'main' | 'footer'} handle @param {MenuNode[]} nodes @param {number} [parent] */
export const hasRoom = (handle, nodes, parent) => (parent === undefined ? nodes.length < menuLimits[handle].top : menuLimits[handle].levels > 1 && (nodes[parent]?.children.length ?? 0) < menuLimits[handle].children)
