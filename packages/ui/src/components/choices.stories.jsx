import { useState } from 'react'
import { Checkbox } from './checkbox'
import { NumberInput } from './number-input'
import { OptionChips } from './option-chips'
import { QuantityStepper } from './quantity-stepper'
import { RadioGroup } from './radio-group'
import { Switch } from './switch'

const meta = /** @satisfies {import('@storybook/react-vite').Meta} */ ({ title: 'Forms/Choices and numbers' })
export default meta
/**
 * @typedef {import('@storybook/react-vite').StoryObj<typeof meta>} Story
 */

const pay = [
  { value: 'cod', label: 'Cash on delivery', description: 'Pay the rider when the parcel arrives' },
  { value: 'online', label: 'Online payment', description: 'Coming later', disabled: true },
]
const sizes = [{ value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L', disabled: true }, { value: 'xl', label: 'XL' }]
const colours = [{ value: 'red', label: 'Maroon', swatch: '#7a1f2b' }, { value: 'blue', label: 'Navy', swatch: '#1f2a5a' }]

/**
 * @param {{ aria: string; }} props
 */
function Chips({ aria }) {
  const [v, setV] = useState('m')
  return <OptionChips aria-label={aria} options={sizes} value={v} onValueChange={setV} />
}
/**
 * @param {{ max?: number; }} props
 */
function Stepper({ max }) {
  const [n, setN] = useState(max ?? 2)
  return <QuantityStepper value={n} onValueChange={setN} max={max} />
}

function Board() {
  const [pm, setPm] = useState('cod')
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Checkbox label="Remember me" />
        <Checkbox label="Checked" defaultChecked />
        <Checkbox label="Some selected" indeterminate />
        <Checkbox label="Invalid" invalid />
        <Checkbox label="Disabled" disabled />
      </div>
      <RadioGroup options={pay} value={pm} onValueChange={setPm} aria-label="Payment method" />
      <RadioGroup options={pay} value={pm} onValueChange={setPm} variant="card" aria-label="Payment method as cards" />
      <div className="flex flex-col gap-2">
        <Switch label="Show on storefront" defaultChecked />
        <Switch label="Off" />
        <Switch label="Disabled" disabled />
      </div>
      <Chips aria="Size" />
      <OptionChips aria-label="Colour" options={colours} value="red" onValueChange={() => {}} />
      <div className="flex flex-wrap items-start gap-6">
        <Stepper />
        <Stepper max={3} />
        <NumberInput defaultValue={5} min={0} max={20} aria-label="Stock" />
      </div>
    </div>
  )
}

export const Default = /** @type {Story} */ ({ render: () => <Board /> })

export const Rtl = /** @type {Story} */ ({
  globals: { direction: 'rtl' },
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      <Checkbox label="مجھے یاد رکھیں" defaultChecked />
      <RadioGroup
        aria-label="ادائیگی"
        variant="card"
        defaultValue="cod"
        options={[{ value: 'cod', label: 'ڈیلیوری پر ادائیگی', description: 'پارسل ملنے پر رقم دیں' }, { value: 'online', label: 'آن لائن ادائیگی', disabled: true }]}
      />
      <Switch label="دکان پر دکھائیں" defaultChecked />
      <Switch label="بند" />
      <OptionChips aria-label="سائز" options={[{ value: 's', label: 'چھوٹا' }, { value: 'm', label: 'درمیانہ' }, { value: 'l', label: 'بڑا', disabled: true }]} value="m" onValueChange={() => {}} />
      <Stepper max={3} />
    </div>
  ),
})

export const Dark = /** @type {Story} */ ({ globals: { brand: 'admin-burgundy', scheme: 'dark' }, render: () => <Board /> })
