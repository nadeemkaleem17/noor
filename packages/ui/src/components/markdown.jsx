// CMS page bodies (DOC-06.8 section 2). Markdown becomes React elements through an allow-list, so there is no HTML string and no sanitiser.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm' // pipe tables only matter here; strikethrough and task lists are not on the allow-list and are dropped
import { safeHref, isExternal } from '../safe-href'
import { Image } from './image'

/**
 * `{{store.phone}}` style tokens come from settings so policy text never hard-codes a number that lives there. Unknown tokens become nothing.
 * @param {string} markdown
 * @param {Record<string, string>} values
 * @returns {string}
 */
export function replaceTokens(markdown, values) {
  return markdown.replace(/\{\{\s*([\w.]+)\s*\}\}/g, /** @param {string} key */ (_, key) => values[key] ?? '')
}

const allowedElements = ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'br']

/**
 * @typedef {object} Props
 * @property {string} source
 * @property {Record<string, string>} [tokens] - Values for `{{token}}`s.
 * @property {string} imageOrigin - Image host. Only images whose URL starts with this origin render (`PUBLIC_IMG_URL`).
 * @property {string} [className]
 */

/**
 * The body's `#` becomes `h2` so the page keeps one `h1`. An image's title attribute `"800x1000"` gives its size.
 * @param {Props} props
 */
export function Markdown({ source, tokens = {}, imageOrigin, className }) {
  const components = /** @type {import('react-markdown').Components} */ ({
    h1: ({ children }) => <h2 className="mt-8 font-heading text-xl">{children}</h2>,
    h2: ({ children }) => <h2 className="mt-8 font-heading text-xl">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-6 font-heading text-lg">{children}</h3>,
    p: ({ children }) => <p className="mt-4">{children}</p>,
    ul: ({ children }) => <ul className="mt-4 list-disc ps-6">{children}</ul>,
    ol: ({ children }) => <ol className="mt-4 list-decimal ps-6">{children}</ol>,
    blockquote: ({ children }) => <blockquote className="mt-4 border-s-4 border-line-strong ps-4 text-fg-soft">{children}</blockquote>,
    hr: () => <hr className="my-8 border-line" />,
    table: ({ children }) => (
      <div className="mt-4 overflow-x-auto" tabIndex={0}>
        <table className="w-full border-collapse text-start">{children}</table>
      </div>
    ),
    th: ({ children }) => <th scope="col" className="border-b border-line-strong px-3 py-2 text-start font-medium">{children}</th>,
    td: ({ children }) => <td className="border-b border-line px-3 py-2 text-start">{children}</td>,
    a: /** @returns {import('react').ReactNode} */ ({ href, children }) => {
      const safe = safeHref(href)
      if (!safe) return <>{children}</> // invalid links render as plain text
      return (
        <a href={safe} rel={isExternal(safe) ? 'noopener noreferrer' : undefined} className="text-accent-text underline underline-offset-4">
          {children}
        </a>
      )
    },
    img: /** @returns {import('react').ReactNode} */ ({ src, alt, title }) => {
      const size = /^(\d{1,5})x(\d{1,5})$/.exec(title ?? '')
      // only our own image host, and only with a known size (no layout shift); everything else is dropped
      if (typeof src !== 'string' || !src.startsWith(imageOrigin.replace(/\/$/, '') + '/') || !size) return null
      return <Image src={src} alt={alt ?? ''} width={Number(size[1])} height={Number(size[2])} className="mt-4 rounded-media" />
    },
  })
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={allowedElements} skipHtml components={components} urlTransform={(url) => url}>
        {replaceTokens(source, tokens)}
      </ReactMarkdown>
    </div>
  )
}
