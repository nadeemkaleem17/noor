/** Markdown that the server already turned into HTML (`lib/markdown.server.jsx`). The string is never the author's own markup, so it is the one place `dangerouslySetInnerHTML` is used for text. @param {{ html: string }} props */
export function RichText({ html }) {
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null
}
