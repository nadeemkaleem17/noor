import { serializeLd } from './jsonld'

/** One or several structured-data objects, each in a script of its own. The text is escaped by `serializeLd`; a script of this type is data, the browser does not run it. @param {{ data: unknown }} props */
export function JsonLd({ data }) {
  return (
    <>
      {(Array.isArray(data) ? data : [data]).map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLd(d) }} />
      ))}
    </>
  )
}
