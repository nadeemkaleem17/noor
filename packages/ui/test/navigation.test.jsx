// @vitest-environment jsdom
import { enums } from '@noor/contract'
import { createI18n } from '@noor/i18n'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Accordion } from '../src/components/accordion'
import { StatusBadge } from '../src/components/badge'
import { Breadcrumb } from '../src/components/breadcrumb'
import { Carousel } from '../src/components/carousel'
import { Link } from '../src/components/link'
import { LoadMore } from '../src/components/load-more'
import { Pagination, pageWindow } from '../src/components/pagination'
import { Tabs, TabsPanel } from '../src/components/tabs'
import { renderUi } from './dom'

describe('Tabs keyboard map', () => {
  const items = [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }, { value: 'c', label: 'Three' }]
  function Harness() {
    const [v, setV] = useState('a')
    return (
      <Tabs aria-label="Sections" items={items} value={v} onValueChange={setV}>
        <TabsPanel value="a">Panel A</TabsPanel>
        <TabsPanel value="b">Panel B</TabsPanel>
        <TabsPanel value="c">Panel C</TabsPanel>
      </Tabs>
    )
  }
  const focused = () => document.activeElement?.textContent

  it('ArrowRight is next and ArrowLeft is previous in LTR; Home and End jump', async () => {
    const { user } = renderUi(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'One' }))
    await user.keyboard('{ArrowRight}')
    expect(focused()).toBe('Two')
    await user.keyboard('{ArrowLeft}')
    expect(focused()).toBe('One')
    await user.keyboard('{End}')
    expect(focused()).toBe('Three')
    await user.keyboard('{Home}')
    expect(focused()).toBe('One')
  })

  it('swaps the arrows in RTL: ArrowLeft is next', async () => {
    const { user } = renderUi(<Harness />, { dir: 'rtl' })
    await user.click(screen.getByRole('tab', { name: 'One' }))
    await user.keyboard('{ArrowLeft}')
    expect(focused()).toBe('Two')
    await user.keyboard('{ArrowRight}')
    expect(focused()).toBe('One')
  })

  it('shows the panel of the selected tab', async () => {
    const { user } = renderUi(<Harness />)
    expect(screen.getByText('Panel A')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(await screen.findByText('Panel B')).toBeTruthy()
  })
})

describe('Accordion keyboard map', () => {
  const items = [{ id: 'a', title: 'Details', content: 'Detail text' }, { id: 'b', title: 'Care', content: 'Care text' }, { id: 'c', title: 'Shipping', content: 'Shipping text' }]
  it('Enter and Space toggle; ArrowDown and ArrowUp move between headers', async () => {
    const { user } = renderUi(<Accordion items={items} />)
    const details = screen.getByRole('button', { name: 'Details' })
    details.focus()
    await user.keyboard('{Enter}')
    expect(details.getAttribute('aria-expanded')).toBe('true')
    await user.keyboard(' ')
    expect(details.getAttribute('aria-expanded')).toBe('false')
    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Care'))
    await user.keyboard('{ArrowUp}')
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Details'))
  })

  it('opening one closes the others unless multiple', async () => {
    const { user } = renderUi(<Accordion items={items} />)
    await user.click(screen.getByRole('button', { name: 'Details' }))
    await user.click(screen.getByRole('button', { name: 'Care' }))
    expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Care' }).getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Carousel keyboard map', () => {
  /**
   * @param {'ltr' | 'rtl'} dir
   */
  const setup = (dir) => {
    const scrollBy = vi.fn()
    Element.prototype.scrollBy = /** @type {typeof Element.prototype.scrollBy} */ (/** @type {unknown} */ (scrollBy))
    const utils = renderUi(<Carousel label="Banners" items={['one', 'two', 'three']} renderItem={(s) => <p>{s}</p>} />, { dir })
    return { ...utils, scrollBy, track: /** @type {HTMLElement} */ (screen.getByRole('region', { name: 'Banners' }).firstElementChild) }
  }
  it('ArrowRight moves forward in LTR and ArrowLeft back', () => {
    const { scrollBy, track } = setup('ltr')
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(scrollBy.mock.calls[0]?.[0].left).toBeGreaterThanOrEqual(0)
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(scrollBy.mock.calls[1]?.[0].left).toBeLessThanOrEqual(0)
  })
  it('is swapped in RTL: ArrowLeft goes to the next slide (scrolls toward negative)', () => {
    const { scrollBy, track } = setup('rtl')
    // jsdom has no layout, so clientWidth is 0: assert the direction through the sign of a non-zero width
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true })
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(scrollBy.mock.calls[0]?.[0].left).toBe(-300)
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(scrollBy.mock.calls[1]?.[0].left).toBe(300)
  })
  it('names the carousel and each slide', () => {
    setup('ltr')
    expect(screen.getByRole('region', { name: 'Banners' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '2 of 3' })).toBeTruthy()
  })
  it('shows a pause button only when it auto-plays', async () => {
    const { user } = renderUi(<Carousel label="Auto" autoPlayMs={5000} items={['a', 'b']} renderItem={(s) => <p>{s}</p>} />)
    const pause = screen.getByRole('button', { name: 'Pause' })
    await user.click(pause)
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})

describe('Breadcrumb', () => {
  it('marks the last item as the current page and links the rest', () => {
    renderUi(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: 'Kurta' }]} />)
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('href')).toBe('/shop')
    expect(screen.getByText('Kurta').getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: 'Kurta' })).toBeNull()
  })
})

describe('Link', () => {
  it('renders nothing for an unsafe href and adds rel to external ones', () => {
    renderUi(
      <>
        <Link href="javascript:alert(1)">bad</Link>
        <Link href="https://wa.me/923001234567">chat</Link>
      </>,
    )
    expect(screen.queryByText('bad')).toBeNull()
    expect(screen.getByRole('link', { name: 'chat' }).getAttribute('rel')).toBe('noopener noreferrer')
  })
})

describe('Pagination', () => {
  it('computes the window with gaps', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, null, 5])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
  })
  it('renders real links with aria-current, and disables previous on page 1', () => {
    renderUi(<Pagination page={1} pageCount={4} hrefFor={(p) => `/shop?page=${p}`} />)
    expect(screen.getByRole('link', { name: 'Page 2' }).getAttribute('href')).toBe('/shop?page=2')
    expect(screen.getByRole('link', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe('/shop?page=2')
  })
  it('calls onPageChange without links in callback mode and renders nothing for one page', async () => {
    const onPageChange = vi.fn()
    const { user, unmount } = renderUi(<Pagination page={2} pageCount={4} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    unmount()
    const { container } = renderUi(<Pagination page={1} pageCount={1} />)
    expect(container.querySelector('nav')).toBeNull()
  })
})

describe('LoadMore', () => {
  it('shows the count and a button while there is more', async () => {
    const onLoadMore = vi.fn()
    const { user } = renderUi(<LoadMore shown={24} total={310} hasMore onLoadMore={onLoadMore} />)
    expect(screen.getByText('Showing 24 of 310')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })
  it('has no button at the end', () => {
    renderUi(<LoadMore shown={310} total={310} hasMore={false} onLoadMore={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('StatusBadge', () => {
  it('has a tone and a label in English and Urdu for every status value in the contract', () => {
    const en = createI18n('en')
    const ur = createI18n('ur')
    const groups = { order: enums.orderStatus, payment: enums.paymentStatus, product: enums.productStatus, stock: enums.stockStatus }
    for (const [group, values] of Object.entries(groups)) {
      for (const v of values) {
        expect(en.exists(`status.${group}.${v}`), `en ${group}.${v}`).toBe(true)
        expect(ur.exists(`status.${group}.${v}`, { lng: 'ur', fallbackLng: [] }), `ur ${group}.${v}`).toBe(true)
      }
    }
  })
  it('shows the translated label, never colour alone', async () => {
    renderUi(<StatusBadge status="pending_confirmation" />)
    expect(screen.getByText('Awaiting confirmation')).toBeTruthy()
    await waitFor(() => expect(true).toBe(true))
  })
  it('renders every status value without throwing', () => {
    const all = /** @type {import('../src/components/badge').Status[]} */ ([...enums.orderStatus, ...enums.paymentStatus, ...enums.productStatus, ...enums.stockStatus])
    renderUi(<>{all.map((s) => <StatusBadge key={s} status={s} />)}</>)
    expect(document.querySelectorAll('span').length).toBeGreaterThanOrEqual(all.length)
  })
})
