/** A handle from a title: lowercase letters, digits and single dashes (`^[a-z0-9]+(-[a-z0-9]+)*$`), at most 70 characters. @param {string} title */
export const slugify = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '')
