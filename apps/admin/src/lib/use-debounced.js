import { useEffect, useState } from 'react'

/** The value, `ms` after it stopped changing. @template T @param {T} value @param {number} ms */
export function useDebounced(value, ms) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
