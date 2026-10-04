import type { Image as ApiImage } from '@noor/contract'
import type { ComponentProps } from 'react'
import { cn } from '../cn'

export type ImageProps = Omit<ComponentProps<'img'>, 'src' | 'srcSet' | 'alt' | 'width' | 'height' | 'loading'> & {
  src: string
  srcSet?: string
  /** Required. Use "" only for a decorative image. */
  alt: string
  width: number
  height: number
  sizes?: string
  /** Above the fold (the main product photo, the hero): loads immediately at high priority. Everything else is lazy. */
  priority?: boolean
  /** CSS aspect ratio such as `3/4`. Defaults to the intrinsic width and height. */
  ratio?: string
  /** Tiny placeholder (data URL) shown while the image loads. */
  lqip?: string
}

/** The API's `Image` object spread into props: `<Image {...imageProps(image)} sizes="50vw" />`. Clients never build transform URLs. */
export const imageProps = (image: ApiImage) => ({ src: image.src, srcSet: image.srcset || undefined, alt: image.alt, width: image.width, height: image.height, lqip: image.lqip })

/** Always sized, so the page does not jump when it loads. */
export function Image({ src, srcSet, alt, width, height, sizes, priority, ratio, lqip, className, style, ...props }: ImageProps) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      className={cn('h-auto max-w-full bg-surface-2 bg-cover object-cover', className)}
      style={{ aspectRatio: ratio ?? `${width} / ${height}`, ...(lqip ? { backgroundImage: `url(${lqip})` } : null), ...style }}
      {...props}
    />
  )
}
