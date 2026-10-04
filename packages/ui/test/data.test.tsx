// @vitest-environment jsdom
import { money } from '@noor/contract'
import { screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { RHFField } from '../src/components/field'
import { Image, imageProps } from '../src/components/image'
import { ImageUpload, type UploadedImage } from '../src/components/image-upload'
import { Input } from '../src/components/input'
import { Markdown, replaceTokens } from '../src/components/markdown'
import { Price } from '../src/components/price'
import { renderUi } from './dom'

const IMG = 'https://img.rubaya.pk'

describe('Markdown (DOC-06.8 section 6)', () => {
  const render = (source: string, tokens?: Record<string, string>) => renderUi(<Markdown source={source} imageOrigin={IMG} tokens={tokens} />)

  it('renders no script, no javascript: link and no foreign image', () => {
    const { container } = render('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](https://evil.example/a.png "10x10")\n\n<iframe src="https://evil.example"></iframe>')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('x') // the link text stays as plain text
    expect(container.textContent).not.toContain('alert(1)')
  })

  it('keeps one h1 on the page: a Markdown # becomes h2', () => {
    const { container } = render('# Big\n\n## Medium\n\n### Small')
    expect(container.querySelector('h1')).toBeNull()
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Big', 'Medium'])
    expect(container.querySelector('h3')?.textContent).toBe('Small')
  })

  it('validates links like LinkButton and marks external ones', () => {
    const { container } = render('[a](/shop) [b](https://wa.me/923001234567) [c](mailto:hi@rubaya.pk) [d](data:text/html,x) [e](//evil.com)')
    const links = [...container.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/shop', 'https://wa.me/923001234567', 'mailto:hi@rubaya.pk'])
    expect(links[1]?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(links[0]?.getAttribute('rel')).toBeNull()
  })

  it('renders an image from our host with the size from its title, and drops one without a size', () => {
    const { container } = render(`![Kurta](${IMG}/w640/a.webp "800x1000")\n\n![No size](${IMG}/w640/b.webp)`)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute('width')).toBe('800')
    expect(imgs[0]?.getAttribute('height')).toBe('1000')
    expect(imgs[0]?.getAttribute('alt')).toBe('Kurta')
  })

  it('does not accept a look-alike image host', () => {
    const { container } = render(`![x](${IMG}.evil.com/a.webp "10x10")`)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders tables with header scope', () => {
    const { container } = render('| Size | Chest |\n|---|---|\n| S | 36 |')
    expect(container.querySelector('th')?.getAttribute('scope')).toBe('col')
    expect(container.querySelectorAll('td')).toHaveLength(2)
  })

  it('replaces tokens from settings and drops unknown ones', () => {
    expect(replaceTokens('Call {{store.phone}} or {{ store.email }}. Free above {{shipping.freeAbove}}{{nope}}', { 'store.phone': '0300 1234567', 'store.email': 'hi@rubaya.pk', 'shipping.freeAbove': 'Rs 5,000' })).toBe('Call 0300 1234567 or hi@rubaya.pk. Free above Rs 5,000')
    const { container } = render('Phone: {{store.phone}}', { 'store.phone': '0300 1234567' })
    expect(container.textContent).toContain('0300 1234567')
  })
})

describe('Price', () => {
  it('formats paisa as rupees, left-to-right', () => {
    const { container } = renderUi(<Price money={money(699000)} />)
    expect(container.textContent?.replace(/\s/g, ' ')).toBe('Rs 6,990.00')
    expect(container.querySelector('bdi')?.getAttribute('dir')).toBe('ltr')
  })
  it('shows a struck-through original price with a hidden "was" label on sale', () => {
    const { container } = renderUi(<Price money={money(499000)} compareAt={money(699000)} />)
    expect(container.querySelector('.line-through')?.textContent?.replace(/\s/g, ' ')).toBe('was Rs 6,990.00')
    expect(container.querySelector('.text-sale')?.textContent?.replace(/\s/g, ' ')).toBe('Rs 4,990.00')
  })
  it('ignores a compareAt that is not higher', () => {
    const { container } = renderUi(<Price money={money(499000)} compareAt={money(499000)} />)
    expect(container.querySelector('.line-through')).toBeNull()
  })
  it('follows the store price display setting and the page language', () => {
    const { container } = renderUi(<Price money={money(699050)} display={{ showDecimals: false, rounding: 'nearest' }} />, { dir: 'rtl' })
    expect(container.textContent).toMatch(/6,991/)
    expect(container.textContent).not.toMatch(/[۰-۹]/) // Western digits (ADR-0018)
  })
})

describe('Image', () => {
  it('is lazy and sized by default, and eager with high priority when asked', () => {
    const { container } = renderUi(
      <>
        <Image src="/a.webp" alt="A" width={800} height={1000} />
        <Image src="/b.webp" alt="" width={800} height={1000} priority />
      </>,
    )
    const [a, b] = [...container.querySelectorAll('img')]
    expect(a?.getAttribute('loading')).toBe('lazy')
    expect(a?.getAttribute('width')).toBe('800')
    expect(a?.style.aspectRatio).toBe('800 / 1000')
    expect(b?.getAttribute('loading')).toBe('eager')
    expect(b?.getAttribute('fetchpriority')).toBe('high')
  })
  it('takes the API image object through imageProps', () => {
    const { container } = renderUi(<Image {...imageProps({ src: '/w640.webp', srcset: '/w320.webp 320w, /w640.webp 640w', width: 640, height: 800, alt: 'Kurta' })} sizes="50vw" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('srcset')).toBe('/w320.webp 320w, /w640.webp 640w')
    expect(img?.getAttribute('sizes')).toBe('50vw')
    expect(img?.getAttribute('alt')).toBe('Kurta')
  })
})

describe('RHFField', () => {
  function Form({ code }: { code: string }) {
    const form = useForm({ defaultValues: { phone: '' } })
    return (
      <form>
        <RHFField control={form.control} name="phone" label="Phone">
          {(field) => <Input {...field} />}
        </RHFField>
        <button type="button" onClick={() => form.setError('phone', { message: code })}>
          fail
        </button>
      </form>
    )
  }
  it('translates an error code and marks the field invalid', async () => {
    const { user } = renderUi(<Form code="phone_invalid" />)
    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(await screen.findByText(/Enter a valid mobile number/)).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Phone' }).getAttribute('aria-invalid')).toBe('true')
  })
  it('translates into Urdu', async () => {
    const { user } = renderUi(<Form code="required" />, { dir: 'rtl' })
    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(await screen.findByText('یہ خانہ ضروری ہے')).toBeTruthy()
  })
  it('shows a generic message for an unknown code, never the raw code', async () => {
    const { user } = renderUi(<Form code="totally_new_code" />)
    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()
    expect(screen.queryByText('totally_new_code')).toBeNull()
  })
})

describe('ImageUpload', () => {
  const file = (name: string) => new File(['x'], name, { type: 'image/png' })
  const media = (name: string): UploadedImage => ({ id: name, src: `/media/${name}`, alt: name })

  it('uploads a chosen file, shows progress, then the thumbnail', async () => {
    let finish!: (m: UploadedImage) => void
    const upload = vi.fn(() => new Promise<UploadedImage>((r) => (finish = r)))
    const onChange = vi.fn()
    const { user } = renderUi(<ImageUpload value={[]} onChange={onChange} upload={upload} />)
    await user.upload(screen.getByLabelText('Drop images here or choose files'), file('a.png'))
    expect(await screen.findByRole('status')).toBeTruthy()
    finish(media('a.png'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([media('a.png')]))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows an error for a failed upload and lets the person dismiss it', async () => {
    const { user } = renderUi(<ImageUpload value={[]} onChange={() => {}} upload={() => Promise.reject(new Error('x'))} />)
    await user.upload(screen.getByLabelText('Drop images here or choose files'), file('a.png'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the drop area when full and removes an image', async () => {
    const onChange = vi.fn()
    const { user } = renderUi(<ImageUpload value={[media('a.png')]} onChange={onChange} upload={vi.fn()} />)
    expect(screen.queryByLabelText('Drop images here or choose files')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('does not send more files than maxFiles allows', async () => {
    const upload = vi.fn((f: File) => Promise.resolve(media(f.name)))
    const { user } = renderUi(<ImageUpload multiple maxFiles={2} value={[media('x.png')]} onChange={() => {}} upload={upload} />)
    await user.upload(screen.getByLabelText('Drop images here or choose files'), [file('a.png'), file('b.png')])
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
  })
})
