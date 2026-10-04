import type { Meta, StoryObj } from '@storybook/react-vite'
import { money } from '@noor/contract'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from './button'
import { RHFField } from './field'
import { Image } from './image'
import { ImageUpload, type UploadedImage } from './image-upload'
import { Input } from './input'
import { Markdown } from './markdown'
import { Price } from './price'

const meta = { title: 'Data-aware pieces' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

// an inline SVG stands in for a product photo
const photo = (label: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" font-size="32" fill="#444">${label}</text></svg>`)}`

const page = `# Delivery

We deliver across Pakistan. Call us on {{store.phone}} or [message us on WhatsApp](https://wa.me/923001234567).

## Rates

| City | Fee | Days |
|---|---|---|
| Lahore | Rs 250 | 1-2 |
| Karachi | Rs 300 | 2-3 |

> Orders above {{shipping.freeAbove}} ship free.

- Cash on delivery
- Open parcel on request

[Unsafe link](javascript:alert(1)) and an <script>alert(1)</script> are not rendered.`

function UploadDemo() {
  const [images, setImages] = useState<UploadedImage[]>([{ id: '1', src: photo('Front'), alt: 'Front' }])
  return (
    <ImageUpload
      multiple
      maxFiles={4}
      value={images}
      onChange={setImages}
      upload={async (file) => {
        await new Promise((r) => setTimeout(r, 800))
        return { id: `${file.name}-${Date.now()}`, src: photo(file.name.slice(0, 10)), alt: file.name }
      }}
    />
  )
}

function FormDemo({ errors }: { errors: boolean }) {
  const form = useForm({ defaultValues: { name: '', phone: '' } })
  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={form.handleSubmit(() => {})}
      noValidate
    >
      <RHFField control={form.control} name="name" label="Name" required>
        {(field) => <Input {...field} autoComplete="name" />}
      </RHFField>
      <RHFField control={form.control} name="phone" label="Phone">
        {(field) => <Input {...field} inputMode="tel" autoComplete="tel" />}
      </RHFField>
      <Button
        type="button"
        onClick={() => {
          if (errors) {
            form.setError('name', { message: 'required' })
            form.setError('phone', { message: 'phone_invalid' })
          }
        }}
      >
        Show errors
      </Button>
    </form>
  )
}

function Board() {
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Price money={money(699000)} size="lg" />
        <Price money={money(499000)} compareAt={money(699000)} />
        <Price money={money(699050)} size="sm" display={{ showDecimals: false, rounding: 'nearest' }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Image src={photo('Priority')} alt="A kurta" width={400} height={500} priority sizes="50vw" />
        <Image src={photo('Lazy')} alt="A dupatta" width={400} height={500} ratio="1/1" />
      </div>
      <Markdown source={page} imageOrigin="https://img.rubaya.pk" tokens={{ 'store.phone': '0300 1234567', 'shipping.freeAbove': 'Rs 5,000' }} />
      <UploadDemo />
      <FormDemo errors />
    </div>
  )
}

export const Default: Story = { render: () => <Board /> }
export const Rtl: Story = { globals: { direction: 'rtl' }, render: () => <Board /> }
export const Dark: Story = { globals: { brand: 'admin-burgundy', scheme: 'dark' }, render: () => <Board /> }
