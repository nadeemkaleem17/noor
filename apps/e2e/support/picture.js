// A real picture to upload, made the way the demo shop's pictures are (sharp is the API's own dependency; the tests borrow its generator).
/** @param {string} text @param {string} [hex] @returns {Promise<{ name: string, mimeType: string, buffer: Buffer }>} */
export async function picture(text, hex = '#3b6e8f') {
  const { placeholderImage } = await import('../../api/src/seed/images.js')
  return { name: `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`, mimeType: 'image/jpeg', buffer: await placeholderImage({ text, hex, caption: 'e2e', width: 900, height: 1200 }) }
}
