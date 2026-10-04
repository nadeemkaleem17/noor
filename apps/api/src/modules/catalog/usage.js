// How many products, variants and options use each piece of catalog structure: what lets the structure screens say "in use" with a number
// (plan/07-admin/04-catalog.md). The foreign keys remain the backstop.
import { and, count, countDistinct, eq, inArray, sql } from 'drizzle-orm'
import { categories } from '../../db/schema/taxonomy.js'
import { productAttributeValues, productCategories, productOptionValues, productOptions, products, variantOptionValues } from '../../db/schema/products.js'

/**
 * @param {import('../../platform/db.js').Database['db']} db
 * @returns {import('./common.js').Usage}
 */
export function createUsage(db) {
  const one = async (/** @type {Promise<{ n: number }[]>} */ q) => (await q)[0]?.n ?? 0
  return {
    categoryPrimary: (id) => one(db.select({ n: count() }).from(products).where(eq(products.primaryCategoryId, id))),

    /** Products shown under each category: tagged with it or with any category below it. */
    async categoryProducts(ids) {
      const [all, tagged] = await Promise.all([db.select({ id: categories.id, parentId: categories.parentId }).from(categories), db.select().from(productCategories)])
      const byParent = new Map()
      for (const c of all) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c.id])
      /** @param {string} id @returns {string[]} */
      const subtree = (id) => [id, ...(byParent.get(id) ?? []).flatMap(subtree)]
      return new Map(ids.map((id) => {
        const inside = new Set(subtree(id))
        return [id, new Set(tagged.filter((t) => inside.has(t.categoryId)).map((t) => t.productId)).size]
      }))
    },

    attributeProducts: (id) => one(db.select({ n: countDistinct(productAttributeValues.productId) }).from(productAttributeValues).where(eq(productAttributeValues.attributeId, id))),
    valueProducts: (id) => one(db.select({ n: countDistinct(productAttributeValues.productId) }).from(productAttributeValues).where(eq(productAttributeValues.valueId, id))),

    /** Products that carry `from` now carry `into` instead (once, if they had both). */
    async moveValue(tx, from, into) {
      const hasInto = tx.select({ id: productAttributeValues.productId }).from(productAttributeValues).where(eq(productAttributeValues.valueId, into))
      await tx.delete(productAttributeValues).where(and(eq(productAttributeValues.valueId, from), inArray(productAttributeValues.productId, sql`(select product_id from (${hasInto}) as already)`)))
      await tx.update(productAttributeValues).set({ valueId: into }).where(eq(productAttributeValues.valueId, from))
    },

    sizeValueVariants: (id) =>
      one(
        db
          .select({ n: countDistinct(variantOptionValues.variantId) })
          .from(variantOptionValues)
          .innerJoin(productOptionValues, eq(productOptionValues.id, variantOptionValues.optionValueId))
          .where(eq(productOptionValues.sizeSystemValueId, id)),
      ),
    sizeSystemOptions: (id) => one(db.select({ n: count() }).from(productOptions).where(eq(productOptions.sizeSystemId, id))),
    sizeChartProducts: (id) => one(db.select({ n: count() }).from(products).where(eq(products.sizeChartId, id))),
    formSchemaProducts: (id) => one(db.select({ n: count() }).from(products).where(eq(products.customSizeSchemaId, id))),
  }
}
