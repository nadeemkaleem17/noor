// Deterministic "random" product photography via picsum.photos, seeded per product/angle
// so the same product always shows the same image (no reshuffling on re-render) while still
// giving the storefront real photos instead of gradient placeholders. Requires the visitor's
// browser to have internet access (this app itself has no image hosting of its own yet).
export function placeholderImage(seed, width = 600, height = 800) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`
}
