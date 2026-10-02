// M0-11 RTL spike (plan/04-design-system/components.md section 8, ADR-0007). One page with every overlay and
// popup Base UI must get right under dir="rtl". Switch the Direction toolbar to RTL and walk the checklist.
// Temporary: the real components replace this in M2 and this file is deleted then.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Combobox } from '@base-ui/react/combobox'
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Select } from '@base-ui/react/select'
import { Tabs } from '@base-ui/react/tabs'
import { Tooltip } from '@base-ui/react/tooltip'

const meta = { title: 'Spikes/RTL' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const btn = 'rounded-control border border-line-strong bg-surface px-3 py-2 text-fg'
const popup = 'rounded-card border border-line bg-surface p-1 text-fg shadow-pop'
const item = 'cursor-default rounded-control px-3 py-1.5 data-[highlighted]:bg-surface-2'

const sizes = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'l', label: 'Large' },
]
const cities = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad']

export const Overlays: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-4 p-4">
      {/* Dialog */}
      <Dialog.Root>
        <Dialog.Trigger className={btn}>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-fg/40" />
          <Dialog.Popup className={`${popup} fixed start-1/2 top-1/2 w-80 -translate-y-1/2 p-4 ltr:-translate-x-1/2 rtl:translate-x-1/2`}>
            <Dialog.Title className="font-heading text-lg">Dialog title</Dialog.Title>
            <Dialog.Description className="mt-1 text-muted">Focus returns to the trigger on close.</Dialog.Description>
            <Dialog.Close className={`${btn} mt-4`}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Drawer: a Dialog docked to the inline-end edge, sliding in from that edge */}
      <Dialog.Root>
        <Dialog.Trigger className={btn}>Open drawer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-fg/40" />
          <Dialog.Popup
            data-testid="drawer"
            className={`${popup} fixed inset-y-0 end-0 w-80 rounded-none p-4 transition-transform duration-(--dur-small) data-[starting-style]:ltr:translate-x-full data-[starting-style]:rtl:-translate-x-full data-[ending-style]:ltr:translate-x-full data-[ending-style]:rtl:-translate-x-full`}
          >
            <Dialog.Title className="font-heading text-lg">Drawer</Dialog.Title>
            <Dialog.Close className={`${btn} mt-4`}>Close drawer</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Menu with a submenu */}
      <Menu.Root>
        <Menu.Trigger className={btn}>Menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4}>
            <Menu.Popup className={popup}>
              <Menu.Item className={item}>Edit</Menu.Item>
              <Menu.Item className={item}>Duplicate</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger className={`${item} flex items-center justify-between gap-6`}>
                  More <span aria-hidden className="rtl:-scale-x-100">›</span>
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner sideOffset={4}>
                    <Menu.Popup className={popup}>
                      <Menu.Item className={item}>Export CSV</Menu.Item>
                      <Menu.Item className={item}>Print</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Select */}
      <Select.Root items={sizes} defaultValue="m">
        <Select.Trigger className={`${btn} flex w-40 items-center justify-between`} aria-label="Size">
          <Select.Value />
          <Select.Icon aria-hidden>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={4} align="start" alignItemWithTrigger={false}>
            <Select.Popup className={popup}>
              <Select.List>
                {sizes.map((s) => (
                  <Select.Item key={s.value} value={s.value} className={item}>
                    <Select.ItemText>{s.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>

      {/* Combobox */}
      <Combobox.Root items={cities}>
        <Combobox.Input aria-label="City" placeholder="City" className={`${btn} w-40`} />
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start">
            <Combobox.Popup className={popup}>
              <Combobox.Empty className="px-3 py-2 text-muted">No match</Combobox.Empty>
              <Combobox.List>
                {(city: string) => (
                  <Combobox.Item key={city} value={city} className={item}>
                    {city}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {/* Tooltip and Popover on the inline-end side */}
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger className={btn}>Tooltip (inline-end)</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="inline-end" sideOffset={8}>
              <Tooltip.Popup className={`${popup} px-2 py-1`}>Appears at the inline-end side</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      <Popover.Root>
        <Popover.Trigger className={btn}>Popover (inline-end)</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="inline-end" sideOffset={8}>
            <Popover.Popup className={`${popup} p-3`}>
              <Popover.Title className="font-heading">Popover</Popover.Title>
              <Popover.Close className={`${btn} mt-2`}>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* Tabs */}
      <Tabs.Root defaultValue="a" className="basis-full">
        <Tabs.List className="flex gap-1 border-b border-line">
          {['a', 'b', 'c'].map((v) => (
            <Tabs.Tab key={v} value={v} className="px-3 py-2 text-muted data-[active]:text-fg data-[active]:font-medium">
              Tab {v.toUpperCase()}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {['a', 'b', 'c'].map((v) => (
          <Tabs.Panel key={v} value={v} className="p-3 text-fg">
            Panel {v.toUpperCase()}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  ),
}
