import { useCallback, useContext, useSyncExternalStore } from 'react'
import { getCollection, setCollection, subscribe, createItem, updateItem, removeItem, getSingleton, setSingleton } from '../lib/db.js'
import { ContractError, summarizeFailures } from '../lib/validate.js'
import { ToastContext } from '../context/toastContext.js'

// Wraps a write so a contract violation becomes a visible error instead of a crash or a silent bad save.
// Returns the write's result on success, or null when the contract rejected it (callers: `if (!result) return`).
function useGuard() {
  const push = useContext(ToastContext) // optional: works (console only) outside a ToastProvider, e.g. in tests
  return useCallback((fn) => {
    try {
      return fn() ?? true
    } catch (e) {
      if (!(e instanceof ContractError)) throw e
      const message = `Can't save — ${summarizeFailures(e.failures)}`
      if (push) push(message, 'danger')
      else console.error(message)
      return null
    }
  }, [push])
}

export function useCollection(name) {
  const guard = useGuard()
  const items = useSyncExternalStore(
    (cb) => subscribe(name, cb),
    () => getCollection(name),
  )
  const create = useCallback((item, idPrefix) => guard(() => createItem(name, item, idPrefix)), [name, guard])
  const update = useCallback((id, patch) => guard(() => updateItem(name, id, patch)), [name, guard])
  const remove = useCallback((id) => removeItem(name, id), [name])
  const replaceAll = useCallback((next) => guard(() => setCollection(name, next)), [name, guard])
  return { items, create, update, remove, replaceAll }
}

export function useSingleton(name) {
  const guard = useGuard()
  const value = useSyncExternalStore(
    (cb) => subscribe(name, cb),
    () => getSingleton(name),
  )
  const save = useCallback((next) => guard(() => setSingleton(name, next)), [name, guard])
  return { value, save }
}
