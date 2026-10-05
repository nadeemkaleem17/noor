// The signed-in staff user: `admin.me.get`, fetched once and kept until a 401 or a sign-out (plan/03 section 6).
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ApiError } from '@noor/contract'
import { redirect, useNavigate } from 'react-router'
import { api, setCsrfToken } from './api'
import { queryClient } from './query-client'
import { loginUrl } from './safe-next'

export const meKey = ['me']

export const meQuery = queryOptions({
  queryKey: meKey,
  queryFn: async ({ signal }) => {
    const me = await api('admin.me.get', { signal })
    setCsrfToken(me.csrfToken)
    return me
  },
  staleTime: Infinity,
  retry: false,
})

/**
 * For route loaders: the signed-in user, or a redirect to /login that remembers where the person was going.
 * @param {Request} request
 */
export async function requireMe(request) {
  try {
    return await queryClient.ensureQueryData(meQuery)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    const url = new URL(request.url)
    throw redirect(loginUrl(url.pathname + url.search))
  }
}

/** The signed-in user. Only below the shell, whose loader has put it in the cache. */
export const useMe = () => useSuspenseQuery(meQuery).data

/**
 * `const can = useCan(); can('orders:dispatch')`. Components check permissions, never role names (plan/07-admin/01 section 8).
 * @returns {(permission: import('@noor/contract').Permission) => boolean}
 */
export function useCan() {
  const { permissions } = useMe()
  return (permission) => permissions.includes(permission)
}

/** Ends the session: tells the server, forgets everything cached and goes to the sign-in screen. */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api('admin.auth.logout'),
    onSettled: () => {
      setCsrfToken('')
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}
