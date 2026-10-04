import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from './button'
import { Combobox } from './combobox'
import { ConfirmDialog } from './confirm-dialog'
import { Dialog } from './dialog'
import { Drawer } from './drawer'
import { Field } from './field'
import { Input } from './input'
import { Menu } from './menu'
import { Popover } from './popover'
import { Select } from './select'
import { ToastProvider, useToast } from './toast'
import { Tooltip } from './tooltip'

const meta = /** @satisfies {import('@storybook/react-vite').Meta} */ ({ title: 'Overlays' })
export default meta
/**
 * @typedef {import('@storybook/react-vite').StoryObj<typeof meta>} Story
 */

const cities = /** @type {import('./combobox').ComboboxOption[]} */ ([
  { value: 'lhe', label: 'Lahore' },
  { value: 'khi', label: 'Karachi' },
  { value: 'isb', label: 'Islamabad' },
  { value: 'rwp', label: 'Rawalpindi', disabled: true },
])
const urduCities = /** @type {import('./combobox').ComboboxOption[]} */ ([
  { value: 'lhe', label: 'لاہور' },
  { value: 'khi', label: 'کراچی' },
  { value: 'isb', label: 'اسلام آباد' },
])

const dialogBody = (
  <Field label="Collection name" hint="Shown on the storefront">
    <Input defaultValue="Eid 2026" />
  </Field>
)
const footer = (
  <>
    <Button variant="secondary">Cancel</Button>
    <Button>Save</Button>
  </>
)

export const DialogOpen = /** @type {Story} */ ({
  render: () => (
    <Dialog defaultOpen title="Edit collection" description="Changes show on the storefront immediately." footer={footer}>
      {dialogBody}
    </Dialog>
  ),
})

export const DialogNotDismissible = /** @type {Story} */ ({
  render: () => (
    <Dialog defaultOpen dismissible={false} title="Finish setup" description="This step is required." footer={<Button>Continue</Button>}>
      {dialogBody}
    </Dialog>
  ),
})

export const DrawerOpen = /** @type {Story} */ ({
  render: () => (
    <Drawer defaultOpen title="Filters" footer={footer}>
      {dialogBody}
    </Drawer>
  ),
})

export const ConfirmDialogs = /** @type {Story} */ ({
  render: () => (
    <div className="flex flex-wrap gap-3">
      <ConfirmDialog trigger={<Button variant="danger">Delete product</Button>} title="Delete this product?" body="It will be removed from the storefront. This cannot be undone." confirmLabel="Delete" onConfirm={() => new Promise((r) => setTimeout(r, 1200))} />
      <ConfirmDialog trigger={<Button variant="secondary">Delete all drafts</Button>} title="Delete 42 drafts?" body="Type the word to confirm." confirmLabel="Delete all" confirmText="DELETE" onConfirm={() => {}} />
    </div>
  ),
})

export const Popovers = /** @type {Story} */ ({
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Popover trigger={<Button variant="secondary">Filters</Button>} label="Filters">
        <p className="w-56">Sort and filter options go here.</p>
      </Popover>
      <Popover trigger={<Button variant="secondary">Inline end</Button>} label="Side panel" side="inline-end">
        <p className="w-40">Opens beside the trigger.</p>
      </Popover>
    </div>
  ),
})

export const MenusAndTooltips = /** @type {Story} */ ({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Menu
        trigger={<IconButton label="Row actions" icon={<Ellipsis aria-hidden className="size-4" />} />}
        items={[
          { label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => {} },
          { label: 'Archive', onSelect: () => {}, disabled: true },
          { label: 'Delete', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => {} },
        ]}
      />
      <Tooltip content="Delete the product">
        <Button variant="secondary">Hover or focus me</Button>
      </Tooltip>
    </div>
  ),
})

function Toasts() {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => toast.push({ title: 'Product saved', tone: 'success' })}>Success</Button>
      <Button variant="secondary" onClick={() => toast.push({ title: 'Stock is low', description: 'Only 2 left of size M', tone: 'warning' })}>Warning</Button>
      <Button variant="danger" onClick={() => toast.push({ title: 'Could not save', description: 'Check your connection and try again.', tone: 'danger' })}>Error</Button>
      <Button variant="ghost" onClick={() => toast.push({ title: 'Order archived', action: { label: 'Undo', onClick: () => {} } })}>With action</Button>
    </div>
  )
}

export const Toast = /** @type {Story} */ ({
  render: () => (
    <ToastProvider>
      <Toasts />
    </ToastProvider>
  ),
})

/**
 * @param {{ options: import('./combobox').ComboboxOption[]; }} props
 */
function Pickers({ options }) {
  const [city, setCity] = useState(/** @type {string | null} */ ('lhe'))
  const [many, setMany] = useState(/** @type {string[]} */ (['khi']))
  const [found, setFound] = useState(/** @type {string | null} */ (null))
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Field label="City (Select)">
        <Select options={options} value={city} onValueChange={setCity} placeholder="Choose a city" />
      </Field>
      <Field label="City (Combobox)">
        <Combobox options={options} value={city} onValueChange={setCity} placeholder="Type a city" />
      </Field>
      <Field label="Cities (multiple)">
        <Combobox multiple options={options} value={many} onValueChange={setMany} placeholder="Add a city" />
      </Field>
      <Field label="City (searches a server, 250 ms)">
        <Combobox
          value={found}
          onValueChange={setFound}
          placeholder="Type to search"
          onSearch={async (q) => {
            await new Promise((r) => setTimeout(r, 400))
            return options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
          }}
        />
      </Field>
      <Field label="Invalid select" error="Choose a city">
        <Select options={options} value={null} placeholder="Choose a city" invalid />
      </Field>
    </div>
  )
}

export const Pickable = /** @type {Story} */ ({ render: () => <Pickers options={cities} /> })

export const Rtl = /** @type {Story} */ ({
  globals: { direction: 'rtl' },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Drawer trigger={<Button>دراز کھولیں</Button>} title="فلٹر" footer={<Button>لاگو کریں</Button>}>
          <p>یہاں فلٹر ہوں گے۔</p>
        </Drawer>
        <Dialog trigger={<Button variant="secondary">ڈائیلاگ</Button>} title="عنوان" description="تفصیل" footer={<Button>ٹھیک ہے</Button>}>
          <p>مواد</p>
        </Dialog>
        <Menu trigger={<Button variant="secondary">اعمال</Button>} items={[{ label: 'ترمیم', onSelect: () => {} }, { label: 'حذف کریں', tone: 'danger', onSelect: () => {} }]} />
        <Popover trigger={<Button variant="secondary">پاپ اوور</Button>} label="پینل" side="inline-end">
          <p className="w-40">پہلو میں کھلتا ہے</p>
        </Popover>
      </div>
      <Pickers options={urduCities} />
    </div>
  ),
})

export const Dark = /** @type {Story} */ ({
  globals: { brand: 'admin-burgundy', scheme: 'dark' },
  render: () => (
    <div className="flex flex-col gap-6">
      <Dialog defaultOpen title="Edit collection" description="Dark theme." footer={footer}>
        {dialogBody}
      </Dialog>
      <Pickers options={cities} />
    </div>
  ),
})
