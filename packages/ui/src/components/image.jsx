import { cn } from '../cn'

/**
 * @typedef {Omit<import('react').ComponentProps<'img'>, 'src' | 'srcSet' | 'alt' | 'width' | 'height' | 'loading'> & {
 * src: string;
 * srcSet?: string;
 * alt: string;
 * width: number;
 * height: number;
 * sizes?: string;
 * priority?: boolean | 'eager'; // true: the page's one largest image, fetched first; 'eager': loaded at once, with no claim on the queue (the first cards of a listing)
 * ratio?: string;
 * lqip?: string;
 * }} ImageProps
 */

/**
 * The API's `Image` object spread into props: `<Image {...imageProps(image)} sizes="50vw" />`. Clients never build transform URLs.
 * @param {import('@noor/contract').Image} image
 */
export const imageProps = (image) => ({ src: image.src, srcSet: image.srcset || undefined, alt: image.alt, width: image.width, height: image.height, lqip: image.lqip })

/**
 * Always sized, so the page does not jump when it loads.
 * @param {ImageProps} props
 */
export function Image({ src, srcSet, alt, width, height, sizes, priority, ratio, lqip, className, style, ...props }) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority === true ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      className={cn('h-auto max-w-full bg-surface-2 bg-cover object-cover', className)}
      style={{ aspectRatio: ratio ?? `${width} / ${height}`, ...(lqip ? { backgroundImage: `url(${lqip})` } : null), ...style }}
      {...props}
    />
  )
}
