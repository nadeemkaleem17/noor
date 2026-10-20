import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { deliveryKeys } from '@/lib/delivery'

export { deliveryKeys }

/** @typedef {import('@noor/contract').Run} Run */
/** @typedef {import('@noor/contract').DeliveryPerson} Person */
/** @typedef {import('@noor/contract').Statement} Statement */
/** @typedef {import('@noor/contract').Receipt} Receipt */

/** The addresses of the run and receipt lists are parsed with the routes' own query schemas. */
export const runListSchema = routes['admin.delivery.runs.list'].query
export const receiptListSchema = routes['admin.delivery.receipts.list'].query

export const deliveryQueries = {
  /** @param {object} params parsed from the address with `runListSchema` */
  runs: (params) => queryOptions({ queryKey: [...deliveryKeys.runs, 'list', params], queryFn: ({ signal }) => api('admin.delivery.runs.list', { query: /** @type {never} */ (params), signal }) }),
  run: (/** @type {string} */ id) => queryOptions({ queryKey: deliveryKeys.run(id), queryFn: ({ signal }) => api('admin.delivery.runs.get', { params: { id }, signal }) }),
  /** @param {string} id @param {{ from?: string; to?: string }} range */
  ledger: (id, range) => queryOptions({ queryKey: deliveryKeys.ledger(id, range), queryFn: ({ signal }) => api('admin.delivery.ledger.statement', { params: { id }, query: range, signal }) }),
  /** @param {object} params parsed from the address with `receiptListSchema` */
  receipts: (params) => queryOptions({ queryKey: [...deliveryKeys.receipts, 'list', params], queryFn: ({ signal }) => api('admin.delivery.receipts.list', { query: /** @type {never} */ (params), signal }) }),
  receipt: (/** @type {string} */ id) => queryOptions({ queryKey: [...deliveryKeys.receipts, 'detail', id], queryFn: ({ signal }) => api('admin.delivery.receipts.get', { params: { id }, signal }) }),
  ofOrder: (/** @type {string} */ id) => queryOptions({ queryKey: deliveryKeys.ofOrder(id), queryFn: ({ signal }) => api('admin.orders.delivery', { params: { id }, signal }) }),
}

/** Everything a rider's cash touches is read again after any change: runs, people (balances), ledgers, receipts, and the orders the run moved. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
  }
}

export function usePersonMutations() {
  const refresh = useRefresh()
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.delivery.people.create', { body }), onSuccess: refresh }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: never }} */ v) => api('admin.delivery.people.update', { params: { id: v.id }, body: v.body }), onSuccess: refresh }),
  }
}

/** Send out, close and the four things that happen to one order of a run; each answers with the run as it is now. */
export function useRunMutations() {
  const queryClient = useQueryClient()
  const refresh = useRefresh()
  /** @param {Run} run */
  const remember = (run) => {
    queryClient.setQueryData(deliveryKeys.run(run.id), run)
    refresh()
  }
  return {
    sendOut: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.delivery.runs.sendOut', { params: { id } }), onSuccess: remember }),
    close: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.delivery.runs.close', { params: { id } }), onSuccess: remember }),
    deliver: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.delivery.assignments.deliver', { params: { id } }), onSuccess: remember }),
    fail: useMutation({ mutationFn: (/** @type {{ id: string; reason: string }} */ v) => api('admin.delivery.assignments.fail', { params: { id: v.id }, body: { reason: v.reason } }), onSuccess: remember }),
    returnToShop: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.delivery.assignments.return', { params: { id } }), onSuccess: remember }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.delivery.assignments.remove', { params: { id } }), onSuccess: remember }),
  }
}

/** A deposit, a fee payout, an adjustment, and the voiding of a receipt. @param {string} personId */
export function useLedgerMutations(personId) {
  const refresh = useRefresh()
  return {
    deposit: useMutation({ mutationFn: (/** @type {{ amount: number; note?: string }} */ body) => api('admin.delivery.ledger.deposit', { params: { id: personId }, body }), onSuccess: refresh }),
    payFee: useMutation({ mutationFn: (/** @type {{ amount: number; note?: string }} */ body) => api('admin.delivery.ledger.payFee', { params: { id: personId }, body }), onSuccess: refresh }),
    adjust: useMutation({ mutationFn: (/** @type {{ amount: number; note: string }} */ body) => api('admin.delivery.ledger.adjust', { params: { id: personId }, body }), onSuccess: refresh }),
  }
}

export function useVoidReceipt() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (/** @type {{ id: string; reason: string }} */ v) => api('admin.delivery.receipts.void', { params: { id: v.id }, body: { reason: v.reason } }), onSuccess: refresh })
}
