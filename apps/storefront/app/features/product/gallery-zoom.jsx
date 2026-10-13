import { useTranslation } from 'react-i18next'
import { Dialog } from '@noor/ui/dialog'
import { Image, imageProps } from '@noor/ui/image'

/** @typedef {import('@noor/contract').ProductDetail['media'][number]} Media */

/**
 * The dialog that shows one picture large. A file of its own: nobody downloads it until a picture is pressed.
 * @param {{ media: Media[], title: string, zoom: number | null, onZoom: (i: number | null) => void, alt: (m: Media, i: number) => string }} props
 */
export default function GalleryZoom({ media, title, zoom, onZoom, alt }) {
  return (
    <Dialog
      open={zoom !== null}
      onOpenChange={(open) => {
        if (!open) onZoom(null)
      }}
      title={title}
      size="lg"
    >
      {zoom !== null && media[zoom] ? <Zoomed media={media} index={zoom} onIndex={onZoom} alt={alt} /> : null}
    </Dialog>
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
