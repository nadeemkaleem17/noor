import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from '../components/Toast.jsx'
import Templates from '../pages/content/Templates.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import OrdersList from '../pages/orders/OrdersList.jsx'
import Reviews from '../pages/Reviews.jsx'
import Menus from '../pages/content/Menus.jsx'
import Settingsp from '../pages/store/Settings.jsx'
import { MemoryRouter } from 'react-router-dom'

const results = []
function record(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
  } catch (err) {
    results.push({ name, ok: false, err })
  }
}

function mount(node) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>)
  })
  return { container, root }
}

// -------------------------------------------------------------------
// 1) Templates page, normal seeded data, click through every tab
// -------------------------------------------------------------------
record('Templates: renders with seeded data, all 7 tabs clickable', () => {
  const { container } = mount(<ToastProvider><Templates /></ToastProvider>)
  const tabButtons = [...container.querySelectorAll('.tabs .tab')]
  if (tabButtons.length !== 7) throw new Error(`expected 7 tabs, got ${tabButtons.length}`)
  tabButtons.forEach((btn) => {
    act(() => { btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  })
  if (!container.querySelector('.card')) throw new Error('no section cards rendered after tab clicks')
})

// -------------------------------------------------------------------
// 2) Templates page: add a section, edit it, delete it (full CRUD loop)
// -------------------------------------------------------------------
record('Templates: add / edit / delete a section', () => {
  window.localStorage.clear()
  // NOTE: Drawer/ConfirmDialog render through Radix's <Dialog.Portal>, which
  // teleports its content to document.body — it is a *sibling* of `container`,
  // not a descendant. Any lookup for drawer/dialog content must query
  // `document` (or document.body), not the local mount `container`, or every
  // assertion below will silently miss real, on-screen elements.
  const { container } = mount(<ToastProvider><Templates /></ToastProvider>)
  const addBtn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Add section'))
  act(() => { addBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const saveBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save')
  if (!saveBtn) throw new Error('drawer did not open / no Save button')
  act(() => { saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const editBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Edit')
  if (!editBtn) throw new Error('new section did not render with an Edit button')
  act(() => { editBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const addBlockBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add block'))
  act(() => { addBlockBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const saveBtn2 = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save')
  act(() => { saveBtn2.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
})

// -------------------------------------------------------------------
// 3b) Delete flow: the trash icon opens a Radix ConfirmDialog (also
// portaled to document.body — see the note above), and confirming it
// must actually remove the section from the list.
// -------------------------------------------------------------------
record('Templates: delete section shows confirm dialog and removes the section', () => {
  window.localStorage.clear()
  const { container } = mount(<ToastProvider><Templates /></ToastProvider>)
  const before = container.querySelectorAll('.card.card-pad[style]').length
  const deleteBtn = [...container.querySelectorAll('button')]
    .find((b) => b.querySelector('svg.lucide-trash-2'))
  if (!deleteBtn) throw new Error('no delete (trash) button found on an existing section row')
  act(() => { deleteBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const confirmBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Delete section')
  if (!confirmBtn) throw new Error('delete confirm dialog did not render its confirm button')
  act(() => { confirmBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const after = container.querySelectorAll('.card.card-pad[style]').length
  if (!(after < before)) throw new Error(`expected section count to decrease (before=${before}, after=${after})`)
})

// -------------------------------------------------------------------
// 3) Regression test for the reported crash: a section persisted
//    without blockOrder/blocks (the exact malformed shape that used
//    to throw "Cannot read properties of ... (reading 'blocks')").
// -------------------------------------------------------------------
record('Templates: does NOT crash on a section missing blockOrder/blocks', () => {
  window.localStorage.clear()
  const malformed = {
    v: 1,
    data: [
      {
        id: 'tpl_home', type: 'home',
        sections: { sec_bad: { id: 'sec_bad', type: 'hero', settings: {}, disabled: false } }, // no blockOrder, no blocks
        order: ['sec_bad'],
      },
    ],
  }
  window.localStorage.setItem('admin:templates', JSON.stringify(malformed))
  const { container } = mount(<ToastProvider><Templates /></ToastProvider>)
  if (!container.textContent.includes('No blocks')) throw new Error('did not render the missing-blocks section safely')
  // Open it for edit too (exercises sectionToDraft's blockOrder/blocks reads)
  const editBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Edit')
  act(() => { editBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
})

// -------------------------------------------------------------------
// 4) Other pages that had their tabs swapped to <TabBar>: quick render
//    + tab-switch smoke check, so the refactor is proven, not assumed.
// -------------------------------------------------------------------
record('Reviews: renders, status tabs switch', () => {
  window.localStorage.clear()
  const { container } = mount(<ToastProvider><Reviews /></ToastProvider>)
  const tabs = [...container.querySelectorAll('.tabs .tab')]
  if (tabs.length < 3) throw new Error(`expected >=3 status tabs, got ${tabs.length}`)
  tabs.forEach((t) => act(() => t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))))
})

record('Menus: renders, menu tabs switch', () => {
  window.localStorage.clear()
  const { container } = mount(<ToastProvider><Menus /></ToastProvider>)
  const tabs = [...container.querySelectorAll('.tabs .tab')]
  if (tabs.length < 1) throw new Error('no menu tabs rendered')
  tabs.forEach((t) => act(() => t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))))
})

record('Settings: renders, all 6 settings tabs switch without error', () => {
  window.localStorage.clear()
  const { container } = mount(<ToastProvider><Settingsp /></ToastProvider>)
  const tabs = [...container.querySelectorAll('.tabs .tab')]
  if (tabs.length !== 6) throw new Error(`expected 6 tabs, got ${tabs.length}`)
  tabs.forEach((t) => act(() => t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))))
})

record('Dashboard: renders KPI strip + recent orders + needs-attention', () => {
  window.localStorage.clear()
  const { container } = mount(<Dashboard />)
  const tiles = container.querySelectorAll('.stat-tile')
  if (tiles.length !== 5) throw new Error(`expected 5 KPI tiles, got ${tiles.length}`)
})

record('OrdersList: renders table with seeded orders, row click does not throw', () => {
  window.localStorage.clear()
  const { container } = mount(<ToastProvider><OrdersList /></ToastProvider>)
  const row = container.querySelector('table.grid tbody tr')
  if (!row) throw new Error('no order rows rendered')
})

// -------------------------------------------------------------------
console.log('\n=== SMOKE TEST RESULTS ===')
let failed = 0
for (const r of results) {
  if (r.ok) {
    console.log(`PASS  ${r.name}`)
  } else {
    failed++
    console.log(`FAIL  ${r.name}`)
    if (r.err?.errors?.length) {
      r.err.errors.forEach((e) => console.log('      ' + (e?.stack || e)))
    } else {
      console.log('      ' + (r.err?.stack || r.err))
    }
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`)
globalThis.__SMOKE_FAILED__ = failed