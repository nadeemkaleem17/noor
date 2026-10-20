import { api } from '@/lib/api'

/** @typedef {'admin.categories.bulkDelete' | 'admin.attributes.bulkDelete' | 'admin.sizeCharts.bulkDelete' | 'admin.products.bulkDelete' | 'admin.collections.bulkDelete' | 'admin.promos.bulkDelete' | 'admin.pages.bulkDelete'} BulkDeleteRoute */

/**
 * The "Delete" action of a `DataTable` bulk bar: the table asks first (and asks for the count to be typed above 20), the server deletes each item by the rules of a single delete and
 * answers with who went and who did not, which the table reports. Only chosen rows can be deleted, never "everything that matches the filters".
 * @param {BulkDeleteRoute} route
 * @param {import('@noor/contract').Permission} permission
 * @returns {import('@/components/bulk-bar').BulkAction}
 */
export const deleteAction = (route, permission) => ({
  id: 'delete',
  label: 'Delete',
  permission,
  destructive: true,
  done: (n) => `${n} deleted`,
  run: async (target) => ('ids' in target ? api(route, { body: { ids: target.ids } }) : { cancelled: true }),
})
