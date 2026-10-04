import type { Meta, StoryObj } from '@storybook/react-vite'
import { money, type Money } from '@noor/contract'
import { useState } from 'react'
import { Field } from './field'
import { Input } from './input'
import { MoneyInput } from './money-input'
import { NativeSelect } from './native-select'
import { PhoneInput } from './phone-input'
import { Textarea } from './textarea'

const meta = { title: 'Forms/Text fields' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const cities = [
  { value: 'lhe', label: 'Lahore' },
  { value: 'khi', label: 'Karachi' },
  { value: 'isb', label: 'Islamabad', disabled: true },
]

function Money_() {
  const [v, setV] = useState<Money | null>(money(699000))
  return (
    <div className="flex flex-col gap-2">
      <Field label="Price" hint="Type rupees, for example 6,990.50">
        <MoneyInput value={v} onValueChange={setV} />
      </Field>
      <output className="text-sm text-muted">{v ? `${v.amount} paisa` : 'empty or not a valid amount'}</output>
    </div>
  )
}

function Phone() {
  const [v, setV] = useState('')
  return (
    <div className="flex flex-col gap-2">
      <Field label="Mobile number" hint="03001234567 or +92 300 1234567">
        <PhoneInput value={v} onValueChange={setV} />
      </Field>
      <output className="text-sm text-muted">{v || 'nothing typed'}</output>
    </div>
  )
}

export const Default: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <Field label="Full name" hint="As on your CNIC"><Input autoComplete="name" placeholder="Ayesha Khan" /></Field>
      <Field label="Address"><Textarea autoComplete="street-address" autoGrow /></Field>
      <Field label="City"><NativeSelect options={cities} placeholder="Choose a city" /></Field>
      <Field label="Weight"><Input suffix="kg" inputMode="decimal" /></Field>
      <Money_ />
      <Phone />
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <Field label="Required" required><Input required placeholder="Placeholder" /></Field>
      <Field label="Invalid" error="Enter a valid email address"><Input defaultValue="not-an-email" /></Field>
      <Field label="Invalid select" error="Choose a city"><NativeSelect options={cities} placeholder="Choose a city" /></Field>
      <Field label="Invalid text area" error="Too short"><Textarea defaultValue="x" /></Field>
      <Field label="Disabled" disabled><Input defaultValue="Cannot edit" disabled /></Field>
      <Field label="Sizes"><div className="flex flex-col gap-2"><Input size="sm" placeholder="sm" /><Input size="md" placeholder="md" /><Input size="lg" placeholder="lg" /></div></Field>
    </div>
  ),
}

export const Rtl: Story = {
  globals: { direction: 'rtl' },
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <Field label="پورا نام" hint="شناختی کارڈ کے مطابق"><Input placeholder="عائشہ خان" autoComplete="name" /></Field>
      <Field label="شہر" error="شہر منتخب کریں"><NativeSelect options={[{ value: 'lhe', label: 'لاہور' }, { value: 'khi', label: 'کراچی' }]} placeholder="شہر چنیں" /></Field>
      <Field label="پتہ"><Textarea defaultValue="مکان نمبر 12، گلی 4" /></Field>
      <Phone />
      <Money_ />
    </div>
  ),
}

export const Dark: Story = {
  globals: { brand: 'admin-burgundy', scheme: 'dark' },
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <Field label="Name"><Input defaultValue="Ayesha" /></Field>
      <Field label="Invalid" error="Required"><Input /></Field>
      <Field label="City"><NativeSelect options={cities} placeholder="Choose a city" /></Field>
      <Field label="Notes"><Textarea /></Field>
      <Field label="Disabled" disabled><Input disabled defaultValue="Locked" /></Field>
    </div>
  ),
}
