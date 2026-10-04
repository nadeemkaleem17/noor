// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/button'
import { ConfirmDialog } from '../src/components/confirm-dialog'
import { Dialog } from '../src/components/dialog'
import { Drawer } from '../src/components/drawer'
import { Menu } from '../src/components/menu'
import { renderUi } from './dom'

describe.each([
  ['Dialog', Dialog],
  ['Drawer', Drawer],
])('%s keyboard map', (_name, Overlay) => {
  const setup = (dismissible = true) =>
    renderUi(
      <Overlay trigger={<Button>Open</Button>} title="Title" description="Body" dismissible={dismissible}>
        <input aria-label="first" />
        <input aria-label="second" />
      </Overlay>,
    )

  it('opens from the trigger and Esc closes it, returning focus to the trigger', async () => {
    const { user } = setup()
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Title' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps Tab inside while open', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true)) // the focus guard hands focus back a tick later
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true })
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true)) // the focus guard hands focus back a tick later
    }
  })

  it('ignores Esc and has no close button when dismissible is false', async () => {
    const { user } = setup(false)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

describe('ConfirmDialog', () => {
  it('does not close on Esc while the confirm action is pending, then closes when it resolves', async () => {
    let finish!: () => void
    const onConfirm = vi.fn(() => new Promise<void>((r) => (finish = r)))
    const { user } = renderUi(<ConfirmDialog trigger={<Button>Delete</Button>} title="Delete?" body="Cannot undo" confirmLabel="Yes, delete" onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    finish()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('stays open when the confirm action fails', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('nope')))
    const { user } = renderUi(<ConfirmDialog trigger={<Button>Delete</Button>} title="T" body="B" confirmLabel="Confirm it" onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm it' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('needs the typed word when confirmText is set', async () => {
    const onConfirm = vi.fn()
    const { user } = renderUi(<ConfirmDialog trigger={<Button>Delete all</Button>} title="T" body="B" confirmLabel="Delete" confirmText="DELETE" onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Delete all' }))
    const confirm = await screen.findByRole('button', { name: 'Delete' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    await user.type(screen.getByRole('textbox'), 'DELETE')
    expect(confirm.hasAttribute('disabled')).toBe(false)
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('does not close on a backdrop click', async () => {
    const { user } = renderUi(<ConfirmDialog trigger={<Button>Delete</Button>} title="T" body="B" confirmLabel="Go" onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('alertdialog')
    await user.click(document.body)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })
})

describe('Menu keyboard map', () => {
  const items = ['Edit', 'Duplicate', 'Archive', 'Delete'].map((label) => ({ label, onSelect: vi.fn() }))
  const setup = () => renderUi(<Menu trigger={<Button>Actions</Button>} items={items} />)
  const focused = () => document.activeElement?.textContent

  it.each(['{Enter}', ' ', '{ArrowDown}'])('opens with %j on the trigger and focuses the first item', async (key) => {
    const { user } = setup()
    screen.getByRole('button', { name: 'Actions' }).focus()
    await user.keyboard(key)
    await screen.findByRole('menu')
    await waitFor(() => expect(focused()).toBe('Edit'))
  })

  it('moves with arrows, Home and End, and jumps by typing a letter', async () => {
    const { user } = setup()
    screen.getByRole('button', { name: 'Actions' }).focus()
    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(focused()).toBe('Edit'))
    await user.keyboard('{ArrowDown}')
    expect(focused()).toBe('Duplicate')
    await user.keyboard('{ArrowUp}')
    expect(focused()).toBe('Edit')
    await user.keyboard('{End}')
    expect(focused()).toBe('Delete')
    await user.keyboard('{Home}')
    expect(focused()).toBe('Edit')
    await user.keyboard('a')
    expect(focused()).toBe('Archive')
  })

  it('selects with Enter and Esc closes and refocuses the trigger', async () => {
    const { user } = setup()
    const trigger = screen.getByRole('button', { name: 'Actions' })
    trigger.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(items[1]?.onSelect).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
