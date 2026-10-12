// Staff-written Markdown as HTML, made on the server (plan/06-storefront/10-performance.md section 5: the Markdown library never reaches the browser). The text still goes through the
// allow-list renderer, so what comes out is what React made of it: escaped text and the few allowed elements, never a string of the author's own HTML. Never imported by browser code.
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from '@noor/ui/markdown'

/** @param {string | undefined} source @param {string} imageOrigin */
export const markdownHtml = (source, imageOrigin) => (source?.trim() ? renderToStaticMarkup(<Markdown source={source} imageOrigin={imageOrigin} />) : '')
