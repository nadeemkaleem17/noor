import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@noor/ui/dialog'
import { Image, imageProps } from '@noor/ui/image'

/** @typedef {import('@noor/contract').ProductDetail['media'][number]} Media */

/**
 * The pictures of a product (plan/06-storefront/04-pdp.md section 3): one scroll-snap strip, so a phone swipes and a keyboard scrolls it with the arrow keys without any script;
 * thumbnails beside it from `lg` up; a click on a picture opens it large. A picture is a link to the big file until the page is hydrated.
 * `focusValue` is the option value chosen: the strip moves to the first picture of that value.
 * @param {{ media: Media[], title: string, focusValue?: string | undefined }} props
 */
export function Gallery({ media, title, focusValue }) {
  const { t } = useTranslation('storefront')
  const id = useId()
  const strip = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [at, setAt] = useState(0)
  const [zoom, setZoom] = useState(/** @type {number | null} */ (null))
  const alt = (/** @type {Media} */ m, /** @type {number} */ i) => m.alt || t('pdp.imageAlt', { title, role: m.role ?? t('pdp.image'), n: i + 1 })

  /** @param {number} i */
  const go = (i) => {
    // along the strip only (`block: 'nearest'` leaves the page where it is), and the same in a right-to-left page
    strip.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const first = focusValue ? media.findIndex((m) => m.optionValueId === focusValue) : -1
  useEffect(() => {
    if (first >= 0) go(first)
  }, [first])

  if (!media.length) return <div className="aspect-3/4 rounded-media bg-surface-2" />
  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-start">
      <div className="relative min-w-0 flex-1">
        <div
          ref={strip}
          role="group"
          aria-roledescription="carousel"
          aria-label={t('pdp.gallery')}
          tabIndex={0}
          onScroll={(e) => {
            const el = e.currentTarget
            setAt(Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-media [scrollbar-width:none] focus-visible:outline-2 [&::-webkit-scrollbar]:hidden"
        >
          {media.map((m, i) => (
            <div key={m.id} id={`${id}-${i}`} className="w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} / ${media.length}`}>
              {m.kind === 'video' && m.videoSrc ? (
                <video controls muted playsInline preload="none" poster={m.src} src={m.videoSrc} className="aspect-3/4 w-full bg-surface-2 object-cover" aria-label={alt(m, i)} />
              ) : (
                <a href={m.src} onClick={(e) => { e.preventDefault(); setZoom(i) }} aria-label={t('pdp.enlarge', { n: i + 1 })} className="block">
                  <Image {...imageProps(m)} alt={alt(m, i)} sizes="(min-width:1024px) 50vw, 100vw" priority={i === 0} ratio="3 / 4" className="w-full bg-surface-2" />
                </a>
              )}
            </div>
          ))}
        </div>
        {media.length > 1 ? (
          <p aria-hidden="true" className="absolute bottom-3 end-3 rounded-full bg-bg/80 px-3 py-1 text-sm tabular-nums">
            {t('pdp.counter', { n: at + 1, total: media.length })}
          </p>
        ) : null}
      </div>
      {media.length > 1 ? (
        <ul aria-label={t('pdp.thumbs')} className="hidden gap-2 lg:flex lg:w-20 lg:shrink-0 lg:flex-col">
          {media.map((m, i) => (
            <li key={m.id}>
              <a
                href={`#${id}-${i}`}
                onClick={(e) => { e.preventDefault(); go(i) }}
                aria-label={t('pdp.showPicture', { n: i + 1 })}
                aria-current={i === at ? 'true' : undefined}
                className={`block overflow-hidden rounded-control border-2 ${i === at ? 'border-accent' : 'border-transparent'}`}
              >
                <Image {...imageProps(m)} alt="" sizes="80px" ratio="3 / 4" className="w-full" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog
        open={zoom !== null}
        onOpenChange={(open) => { if (!open) setZoom(null) }}
        title={title}
        size="lg"
      >
        {zoom !== null && media[zoom] ? <Zoomed media={media} index={zoom} onIndex={setZoom} alt={alt} /> : null}
      </Dialog>
    </div>
  )
}

/** The big picture in the dialog: arrow keys and two buttons move through the pictures, Esc and the close button are the dialog's. @param {{ media: Media[], index: number, onIndex: (i: number) => void, alt: (m: Media, i: number) => string }} props */
function Zoomed({ media, index, onIndex, alt }) {
  const { t } = useTranslation('storefront')
  const m = /** @type {Media} */ (media[index])
  const step = (/** @type {number} */ d) => onIndex((index + d + media.length) % media.length)
  return (
    <div
      onKeyDown={(e) => {
        // the keys follow the page direction
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
        if (e.key === 'ArrowRight') step(rtl ? -1 : 1)
        if (e.key === 'ArrowLeft') step(rtl ? 1 : -1)
      }}
      className="flex flex-col gap-3"
    >
      <Image {...imageProps(m)} alt={alt(m, index)} sizes="90vw" className="mx-auto max-h-[70dvh] w-auto max-w-full object-contain" />
      {media.length > 1 ? (
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => step(-1)} className="h-11 rounded-control border border-line-strong px-4">{t('pdp.prev')}</button>
          <span aria-live="polite" className="text-sm tabular-nums">{t('pdp.counter', { n: index + 1, total: media.length })}</span>
          <button type="button" onClick={() => step(1)} className="h-11 rounded-control border border-line-strong px-4">{t('pdp.next')}</button>
        </div>
      ) : null}
    </div>
  )
}
