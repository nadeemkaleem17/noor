import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '@/lib/api'
import { meKey } from '@/lib/session'
import { safeNext } from '@/lib/safe-next'

/** @typedef {import('@noor/contract').LoginResult} LoginResult */

export const useLogin = () => useMutation({ mutationFn: (/** @type {{ email: string; password: string; }} */ body) => api('admin.auth.login', { body }) })
export const useVerifyTwoFactor = () =>
  useMutation({ mutationFn: (/** @type {{ code: string; } | { recoveryCode: string; }} */ body) => api('admin.auth.verifyTwoFactor', { body }) })
export const useResetPassword = (/** @type {string} */ token) =>
  useMutation({ mutationFn: (/** @type {string} */ password) => api('admin.auth.resetPassword', { params: { token }, body: { password } }) })
export const useAcceptInvite = (/** @type {string} */ token) =>
  useMutation({ mutationFn: (/** @type {string} */ password) => api('admin.auth.acceptInvite', { params: { token }, body: { password } }) })
export const useInvite = (/** @type {string} */ token) =>
  useQuery({ queryKey: ['invite', token], queryFn: ({ signal }) => api('admin.auth.getInvite', { params: { token }, signal }), retry: false, staleTime: Infinity })
export const useBeginTwoFactor = () => useMutation({ mutationFn: () => api('admin.me.twoFactor.begin') })
export const useEnableTwoFactor = () => useMutation({ mutationFn: (/** @type {string} */ code) => api('admin.me.twoFactor.enable', { body: { code } }) })
export const useConfirmPassword = () => useMutation({ mutationFn: (/** @type {string} */ password) => api('admin.me.confirmPassword', { body: { password } }) })

/** `?next=` from the address, if it is a same-origin path. */
export function useNext() {
  const [params] = useSearchParams()
  return safeNext(params.get('next'))
}

/** Where a sign-in step leads: the next step, or into the app. */
export function useContinueAfterSignIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const next = useNext()
  const query = next ? `?next=${encodeURIComponent(next)}` : ''
  return (/** @type {LoginResult} */ result) => {
    if (result.next === 'two_factor') return navigate(`/login/2fa${query}`)
    if (result.next === 'enrol_two_factor') return navigate(`/enrol-2fa${query}`)
    queryClient.removeQueries({ queryKey: meKey })
    return navigate(next ?? '/', { replace: true })
  }
}
