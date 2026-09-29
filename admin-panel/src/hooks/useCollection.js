import { useCallback, useContext, useSyncExternalStore } from 'react'
import {
  getCollection, setCollection, subscribe, createItem, updateItem, removeItem,
  getSingleton, setSingleton, getStatus, refresh,
} from '../lib/db.js'
import { ContractError, summarizeFailures, summarizeErrors } from '../lib/validate.js'
import { ApiError } from '../lib/api.js'
import { ToastContext } from '../context/toastContext.js'

function describe(e) {
  if (e instanceof ContractError) return `Can't save — ${summarizeFailures(e.failures)}`
  if (e instanceof ApiError) return `Can't save — ${e.issues?.length ? summarizeErrors(e.issues) : e.message}`
  return null
}

// Wraps a write so a contract violation or API error becomes a visible error instead of a crash or a
// silent bad save. Returns the write's result on success, or null when it was rejected
// (callers: `if (!result) return`). Local writes stay synchronous; API writes return a Promise that
// resolves the same way — `await` works for both.
function useGuard() {
  const push = useContext(ToastContext) // optional: works (console only) outside a ToastProvider, e.g. in tests
  return useCallback((fn) => {
    const report = (e) => {
      const message = describe(e)
      if (!message) throw e
      if (push) push(message, 'danger')
      else console.error(message)
      return null
    }
    try {
      const result = fn()
      if (result && typeof result.then === 'function') {
        return result.then((value) => value ?? true, (e) => {
          try { return report(e) } catch (unexpected) {
            console.error(unexpected)
            if (push) push("Something went wrong — the change wasn't saved", 'danger')
            return null
          }
        })
      }
      return result ?? true
    } catch (e) {
      return report(e)
    }
  }, [push])
}

// status: { state: 'ready' | 'loading' | 'error', error } — only ever not-ready for collections the
// API serves (see lib/db.js). retry() re-fetches.
function useStatus(name) {
  const status = useSyncExternalStore((cb) => subscribe(name, cb), () => getStatus(name))
  const retry = useCallback(() => refresh(name), [name])
  return { status, retry }
}

export function useCollection(name) {
  const guard = useGuard()
  const items = useSyncExternalStore(
    (cb) => subscribe(name, cb),
    () => getCollection(name),
  )
  const { status, retry } = useStatus(name)
  const create = useCallback((item, idPrefix) => guard(() => createItem(name, item, idPrefix)), [name, guard])
  const update = useCallback((id, patch) => guard(() => updateItem(name, id, patch)), [name, guard])
  const remove = useCallback((id) => guard(() => removeItem(name, id)), [name, guard])
  const replaceAll = useCallback((next) => guard(() => setCollection(name, next)), [name, guard])
  return { items, create, update, remove, replaceAll, status, retry }
}

export function useSingleton(name) {
  const guard = useGuard()
  const value = useSyncExternalStore(
    (cb) => subscribe(name, cb),
    () => getSingleton(name),
  )
  const { status, retry } = useStatus(name)
  const save = useCallback((next) => guard(() => setSingleton(name, next)), [name, guard])
  return { value, save, status, retry }
}
