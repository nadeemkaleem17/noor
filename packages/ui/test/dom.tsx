// Helpers for component tests in jsdom: the providers every component expects, and the few browser APIs jsdom lacks.
import { DirectionProvider } from '@base-ui/react/direction-provider'
import { createI18n } from '@noor/i18n'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as unknown as typeof window.matchMedia

afterEach(() => cleanup())

export function renderUi(ui: ReactElement, { dir = 'ltr' }: { dir?: 'ltr' | 'rtl' } = {}) {
  document.documentElement.dir = dir
  const user = userEvent.setup()
  const result = render(
    <I18nextProvider i18n={createI18n(dir === 'rtl' ? 'ur' : 'en')}>
      <DirectionProvider direction={dir}>{ui}</DirectionProvider>
    </I18nextProvider>,
  )
  return { user, ...result }
}
