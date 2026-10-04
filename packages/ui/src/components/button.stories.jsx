import { Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Button, IconButton, LinkButton } from './button'

const meta = /** @satisfies {import('@storybook/react-vite').Meta<typeof Button>} */ ({ title: 'Actions/Button', component: Button, args: { children: 'Add to bag' } })
export default meta
/**
 * @typedef {import('@storybook/react-vite').StoryObj<typeof meta>} Story
 */

const row = 'flex flex-wrap items-center gap-3'

export const Variants = /** @type {Story} */ ({
  render: () => (
    <div className={row}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
})

export const Sizes = /** @type {Story} */ ({
  render: () => (
    <div className={row}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button>Brand default</Button>
    </div>
  ),
})

export const States = /** @type {Story} */ ({
  render: () => (
    <div className={row}>
      <Button>Default</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
      <Button iconStart={<ShoppingBag aria-hidden className="size-4" />}>With icon</Button>
      <Button iconEnd={<Plus aria-hidden className="size-4" />} variant="secondary">Icon at end</Button>
      <Button fullWidth variant="secondary">Full width</Button>
    </div>
  ),
})

export const IconButtons = /** @type {Story} */ ({
  render: () => (
    <div className={row}>
      <IconButton label="Delete" icon={<Trash2 aria-hidden className="size-4" />} />
      <IconButton label="Delete" variant="danger" icon={<Trash2 aria-hidden className="size-4" />} />
      <IconButton label="Delete" variant="secondary" size="sm" icon={<Trash2 aria-hidden className="size-4" />} />
      <IconButton label="Delete" disabled icon={<Trash2 aria-hidden className="size-4" />} />
      <IconButton label="Delete" loading icon={<Trash2 aria-hidden className="size-4" />} />
    </div>
  ),
})

export const LinkButtons = /** @type {Story} */ ({
  render: () => (
    <div className={row}>
      <LinkButton href="/shop">Shop</LinkButton>
      <LinkButton href="https://wa.me/923001234567" variant="secondary">WhatsApp (external)</LinkButton>
      <LinkButton href="javascript:alert(1)">Unsafe link renders nothing</LinkButton>
    </div>
  ),
})

export const Rtl = /** @type {Story} */ ({
  globals: { direction: 'rtl' },
  render: () => (
    <div className={row}>
      <Button iconStart={<ShoppingBag aria-hidden className="size-4" />}>بیگ میں شامل کریں</Button>
      <Button variant="secondary">منسوخ کریں</Button>
      <Button loading>انتظار کریں</Button>
    </div>
  ),
})

export const Dark = /** @type {Story} */ ({
  globals: { brand: 'admin-burgundy', scheme: 'dark' },
  render: () => (
    <div className={row}>
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
})
