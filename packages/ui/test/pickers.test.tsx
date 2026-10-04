// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/button'
import { Combobox, type ComboboxOption } from '../src/components/combobox'
import { Popover } from '../src/components/popover'
import { Select } from '../src/components/select'
import { ToastProvider, useToast } from '../src/components/toast'
import { Tooltip } from '../src/components/tooltip'
import { renderUi } from './dom'

const cities: ComboboxOption[] = [
  { value: 'lhe', label: 'Lahore' },
  { value: 'khi', label: 'Karachi' },
  { value: 'isb', label: 'Islamabad' },
]

describe('Select keyboard map', () => {
  const setup = (onValueChange = vi.fn()) => {
    const utils = renderUi(<Select aria-label="City" options={cities} value="lhe" onValueChange={onValueChange} />)
    return { ...utils, onValueChange, trigger: screen.getByRole('combobox', { name: 'City' }) }
  }

  it('ArrowDown opens it, arrows move, Enter chooses', async () => {
    const { user, trigger, onValueChange } = setup()
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('khi'))
  })

  it('Esc closes without a change and refocuses the trigger', async () => {
    const { user, trigger, onValueChange } = setup()
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it('shows the placeholder when there is no value', () => {
    renderUi(<Select aria-label="City" options={cities} value={null} placeholder="Choose a city" />)
    expect(screen.getByText('Choose a city')).toBeTruthy()
  })
})

describe('Combobox keyboard map', () => {
  function Single({ onSearch }: { onSearch?: (q: string) => Promise<ComboboxOption[]> }) {
    const [v, setV] = useState<string | null>(null)
    return (
      <>
        <output data-testid="value">{v ?? 'none'}</output>
        {onSearch ? (
          <Combobox aria-label="City" onSearch={onSearch} value={v} onValueChange={setV} />
        ) : (
          <Combobox aria-label="City" options={cities} value={v} onValueChange={setV} />
        )}
      </>
    )
  }
  const value = () => screen.getByTestId('value').textContent

  it('typing filters, arrows move and Enter chooses', async () => {
    const { user } = renderUi(<Single />)
    const input = screen.getByRole('combobox', { name: 'City' })
    await user.click(input)
    await user.keyboard('ka')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Karachi']))
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(value()).toBe('khi'))
  })

  it('shows the empty text when nothing matches', async () => {
    const { user } = renderUi(<Single />)
    await user.click(screen.getByRole('combobox', { name: 'City' }))
    await user.keyboard('zzz')
    expect(await screen.findByText('No results')).toBeTruthy()
  })

  it('Esc closes the list without choosing', async () => {
    const { user } = renderUi(<Single />)
    await user.click(screen.getByRole('combobox', { name: 'City' }))
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(value()).toBe('none')
  })

  it('async mode waits 250 ms after typing stops, searches once, and ignores a late answer to an older query', async () => {
    const calls: string[] = []
    const resolvers: Record<string, (o: ComboboxOption[]) => void> = {}
    const onSearch = vi.fn((q: string) => {
      calls.push(q)
      return new Promise<ComboboxOption[]>((r) => (resolvers[q] = r))
    })
    const { user } = renderUi(<Single onSearch={onSearch} />)
    await user.click(screen.getByRole('combobox', { name: 'City' }))
    await user.keyboard('ka')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(calls).toEqual(['ka']), { timeout: 1500 })
    await user.keyboard('r')
    await waitFor(() => expect(calls).toEqual(['ka', 'kar']), { timeout: 1500 })
    await act(async () => resolvers['kar']?.([{ value: 'khi', label: 'Karachi' }]))
    await act(async () => resolvers['ka']?.([{ value: 'old', label: 'Stale result' }]))
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Karachi']))
  })

  it('multiple: chooses several and removes a chip', async () => {
    function Multi() {
      const [v, setV] = useState<string[]>(['lhe'])
      return <Combobox multiple aria-label="Cities" options={cities} value={v} onValueChange={setV} />
    }
    const { user } = renderUi(<Multi />)
    expect(screen.getByText('Lahore')).toBeTruthy()
    await user.click(screen.getByRole('combobox', { name: 'Cities' }))
    await user.click(await screen.findByRole('option', { name: 'Karachi' }))
    await screen.findByRole('button', { name: 'Remove Karachi' })
    await user.click(screen.getByRole('button', { name: 'Remove Lahore', hidden: true }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Lahore', hidden: true })).toBeNull())
  })
})

describe('Popover and Tooltip', () => {
  it('Popover opens from the trigger; Esc closes it and refocuses the trigger', async () => {
    const { user } = renderUi(
      <Popover trigger={<Button>Filters</Button>} label="Filters panel">
        <p>Panel body</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Filters' })
    await user.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Filters panel' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('Tooltip shows on keyboard focus and Esc hides it', async () => {
    const { user } = renderUi(
      <Tooltip content="Add to wishlist" delay={0}>
        <Button>Heart</Button>
      </Tooltip>,
    )
    await user.tab()
    expect(await screen.findByText('Add to wishlist')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Add to wishlist')).toBeNull())
  })
})

describe('Toast', () => {
  function Pusher({ count = 1, danger = false, action = false }: { count?: number; danger?: boolean; action?: boolean }) {
    const toast = useToast()
    return (
      <Button
        onClick={() => {
          for (let i = 0; i < count; i++) {
            toast.push({ title: `Saved ${i + 1}`, description: 'All good', tone: danger ? 'danger' : 'success', action: action ? { label: 'Undo', onClick: () => {} } : undefined })
          }
        }}
      >
        Push
      </Button>
    )
  }

  it('shows a toast with its title and description, and the close button removes it', async () => {
    const { user } = renderUi(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Push' }))
    expect(await screen.findByText('Saved 1')).toBeTruthy()
    expect(screen.getByText('All good')).toBeTruthy()
    await user.click(screen.getByLabelText('Dismiss'))
    await waitFor(() => expect(screen.queryByText('Saved 1')).toBeNull())
  })

  it('shows at most 3 toasts at once', async () => {
    const { user } = renderUi(
      <ToastProvider>
        <Pusher count={5} />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Push' }))
    await screen.findByText('Saved 5')
    await waitFor(() => expect(screen.getAllByLabelText('Dismiss').length).toBeLessThanOrEqual(3))
  })

  it('renders the action button', async () => {
    const { user } = renderUi(
      <ToastProvider>
        <Pusher action />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Push' }))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy()
  })
})
