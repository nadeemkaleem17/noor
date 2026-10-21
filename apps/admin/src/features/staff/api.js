import { routes } from '@noor/contract'
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const staffKeys = { all: ['staff'], roles: ['staff', 'roles'] }

/** The list is parsed from the address with the route's own query schema. */
export const staffListSchema = routes['admin.staff.list'].query

export const staffQueries = {
  /** @param {object} params parsed from the address with `staffListSchema` */
  list: (params) => queryOptions({ queryKey: [...staffKeys.all, 'list', params], queryFn: ({ signal }) => api('admin.staff.list', { query: /** @type {never} */ (params), signal }) }),
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: [...staffKeys.all, 'detail', id], queryFn: ({ signal }) => api('admin.staff.get', { params: { id }, signal }) }),
}

/** The custom roles staff made (a base role plus what is added and taken away), with how many people have each. */
export const profilesQuery = queryOptions({ queryKey: [...staffKeys.all, 'profiles'], queryFn: ({ signal }) => api('admin.profiles.list', { signal }), staleTime: 60_000 })

/** The roles with their permissions, as the server enforces them: the screen never keeps its own copy of the matrix. */
export const rolesQuery = queryOptions({ queryKey: staffKeys.roles, queryFn: ({ signal }) => api('admin.roles.list', { signal }), staleTime: 5 * 60_000 })
