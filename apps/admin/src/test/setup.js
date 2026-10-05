// Browser APIs jsdom lacks, and cleanup between tests.
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= /** @type {typeof ResizeObserver} */ (/** @type {unknown} */ (ResizeObserverStub))
Element.prototype.scrollIntoView ??= () => {}
window.matchMedia ??= /** @type {typeof window.matchMedia} */ (
  /** @type {unknown} */ ((/** @param {string} query */ (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })))
)

// the first screen of a test loads its route chunk from disk, which can take seconds on a busy machine
configure({ asyncUtilTimeout: 10_000 })

afterEach(() => cleanup())
