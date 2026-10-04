// What `media.process` does to the bytes of an upload: check them, strip metadata, measure, make the sizes and the blur placeholder.
import sharp from 'sharp'
import { MAX_SIDE, sizesFolder, sizesFor } from './images.js'

/** A file we refuse; `reason` is a short code the admin screen translates. */
export class RejectedUpload extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(reason)
    this.reason = reason
    this.name = 'RejectedUpload'
  }
}

/**
 * @param {Buffer} data the uploaded file, already recognised by its first bytes as `type`
 * @param {keyof typeof import('./images.js').EXTENSIONS} type
 * @param {string} objectKey where the original lives (the sizes go beside it)
 * @returns {Promise<{ original: Buffer, width: number, height: number, lqip: string | null, sizes: { key: string, data: Buffer }[] }>}
 */
export async function processImage(data, type, objectKey) {
  /** @type {import('sharp').Sharp} */
  let image
  let meta
  try {
    // limitInputPixels stops a small file that expands to gigabytes (decompression bomb) before it is decoded
    image = sharp(data, { limitInputPixels: MAX_SIDE * MAX_SIDE })
    meta = await image.metadata()
  } catch {
    throw new RejectedUpload('unreadable')
  }
  const swap = (meta.orientation ?? 1) >= 5 // phone photos are stored sideways with an orientation flag
  const [width, height] = swap ? [meta.height, meta.width] : [meta.width, meta.height]
  if (!width || !height) throw new RejectedUpload('unreadable')
  if (width > MAX_SIDE || height > MAX_SIDE) throw new RejectedUpload('too_many_pixels')

  try {
    // rotate() applies the orientation; sharp writes no EXIF, GPS or colour-profile metadata unless asked, which is the strip
    const upright = () => sharp(data, { limitInputPixels: MAX_SIDE * MAX_SIDE }).rotate()
    const original = await encode(upright(), type)
    const folder = sizesFolder(objectKey)
    const sizes = []
    for (const w of sizesFor(width)) {
      const resized = () => upright().resize({ width: w, withoutEnlargement: true })
      sizes.push({ key: `${folder}/w${w}.webp`, data: await resized().webp({ quality: 80 }).toBuffer() })
      sizes.push({ key: `${folder}/w${w}.jpg`, data: await resized().flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer() })
    }
    const tiny = await upright().resize({ width: 16 }).flatten({ background: '#ffffff' }).blur(1).webp({ quality: 30 }).toBuffer()
    const lqip = `data:image/webp;base64,${tiny.toString('base64')}`
    return { original, width, height, lqip: lqip.length <= 1500 ? lqip : null, sizes }
  } catch {
    throw new RejectedUpload('unreadable')
  }
}

/** Same format out as in, so the file keeps its extension. @param {import('sharp').Sharp} s @param {keyof typeof import('./images.js').EXTENSIONS} type */
function encode(s, type) {
  switch (type) {
    case 'image/jpeg':
      return s.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    case 'image/png':
      return s.png().toBuffer()
    case 'image/webp':
      return s.webp({ quality: 90 }).toBuffer()
    case 'image/avif':
      return s.avif({ quality: 60 }).toBuffer()
  }
}
